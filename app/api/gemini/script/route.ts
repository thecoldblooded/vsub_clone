import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/vertex";

export async function POST(req: Request) {
    try {
        const { prompt, type } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
        }

        let systemInstruction = "";
        if (type === "roblox-rant") {
            systemInstruction = "You are a creative scriptwriter for Roblox rant videos. Write a short, engaging, and funny rant based on the user's topic. Split the script into short sentences suitable for text-to-speech. Return ONLY the script text.";
        } else if (type === "roblox-rant-viral") {
            systemInstruction = `You are a viral content expert for the Roblox Rants niche.
Your task is to:
1. Generate 5 viral video ideas based on the user's topic (or general viral topics if none provided).
2. Select the single best idea that is most likely to hit 10M+ views.
3. Generate a viral title (2–6 words + 😭🙏) for that idea. THE TITLE MUST BE IN ALL CAPS (UPPERCASE).
4. Write a viral voiceover script for that best idea.

WHAT THE NICHE IS:
Short emotional storytelling videos told in first-person with Roblox gameplay.
Topics: crush stories, school drama, friendships, embarrassing moments, relatable teen situations, secrets, twists.
Tone: Emotional, dramatic, relatable, fast-paced.

SCRIPT REQUIREMENTS:
- 170–190 words MAX (approx 1 minute).
- NO timestamps, NO explanations, NO intro text.
- Must start with a powerful hook sentence (first 1-2 seconds).
- Arc: Hook -> Backstory -> Rising tension -> Key moment -> Emotional payoff/ending.
- Include small, realistic teen dialogue.
- Must feel like a true story.
- Add related emojis at the end of sentences frequently.

OUTPUT FORMAT:
Return a JSON object with the following structure:
{
  "title": "Your Viral Title Here 😭🙏",
  "script": "Your full script here..."
}
Return ONLY the JSON object. Do not wrap it in markdown code blocks.`;
        } else if (type === "creepy-cartoon") {
            systemInstruction = "You are a horror story writer. Write a short, creepy story based on the user's prompt. The story should be suspenseful and scary. Return ONLY the story text.";
        } else {
            systemInstruction = "You are a helpful creative assistant. Write a script based on the user's prompt.";
        }

        // Use OAuth token instead of API Key
        let accessToken;
        try {
            accessToken = await getAccessToken();
        } catch (e) {
            return NextResponse.json({ error: "Authentication required" }, { status: 401 });
        }

        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: systemInstruction + "\n\nUser Prompt: " + prompt }]
                }]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Gemini API Error:", errorText);
            return NextResponse.json({ error: "Failed to generate script", details: errorText }, { status: response.status });
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            return NextResponse.json({ error: "No text generated" }, { status: 500 });
        }

        // For viral mode, we expect JSON. For others, just text.
        if (type === "roblox-rant-viral") {
            try {
                // Clean up potential markdown code blocks
                const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(cleanJson);
                return NextResponse.json({ script: parsed.script, title: parsed.title });
            } catch (e) {
                console.error("Failed to parse JSON from AI:", text);
                // Fallback: treat whole text as script if parsing fails
                return NextResponse.json({ script: text, title: "Viral Roblox Rant" });
            }
        }

        return NextResponse.json({ script: text });

    } catch (error: any) {
        console.error("Script Generation Error:", error);
        return NextResponse.json({ error: "Failed to generate script", details: error.message }, { status: 500 });
    }
}

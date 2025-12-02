import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/vertex";

export async function POST(req: Request) {
    try {
        const { script, availableSounds } = await req.json();

        if (!script) {
            return NextResponse.json({ error: "Script is required" }, { status: 400 });
        }

        const accessToken = await getAccessToken();
        const projectId = process.env.GOOGLE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "vsub-clone";
        const modelId = "gemini-2.5-pro";
        const apiKey = process.env.GEMINI_API_KEY;

        const prompt = `
        Analyze the following video script and identify 14 keywords or phrases that would be perfect for a meme overlay.
        For each keyword, provide:
        1. The exact word/phrase from the script.
        2. A search query for imgflip.com to find a relevant meme template.
        3. A sound effect ID from the provided list. You MUST select a sound effect for every keyword.

        Script: "${script}"

        Available Sound Effects: ${JSON.stringify(availableSounds)}

        Return a JSON array of objects with keys: "word", "searchQuery", "soundEffectId".
        `;

        let url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${modelId}:generateContent`;
        let headers: any = {
            'Content-Type': 'application/json'
        };

        if (apiKey) {
            url += `?key=${apiKey}`;
        } else {
            headers['Authorization'] = `Bearer ${accessToken}`;
            headers['x-goog-user-project'] = projectId;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: "application/json"
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Vertex AI Error:", errorText);
            return NextResponse.json({ error: "Failed to generate suggestions via Vertex AI" }, { status: 500 });
        }

        const data = await response.json();
        console.log("Vertex AI Response Data:", JSON.stringify(data, null, 2)); // Debug log

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
            console.error("Vertex AI returned no text in candidates");
            return NextResponse.json({ overlays: [] });
        }

        let suggestions = [];
        try {
            // Clean up markdown code blocks if present
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            suggestions = JSON.parse(cleanText);
            console.log("Parsed Suggestions:", suggestions); // Debug log
        } catch (e) {
            console.error("Failed to parse Vertex response", text);
            return NextResponse.json({ error: "Failed to parse suggestions" }, { status: 500 });
        }

        // Now fetch meme URLs
        const overlays = await Promise.all(suggestions.map(async (item: any) => {
            try {
                const searchUrl = `https://imgflip.com/search?q=${encodeURIComponent(item.searchQuery)}`;
                console.log(`Searching Imgflip: ${searchUrl}`); // Debug log
                const res = await fetch(searchUrl);
                const html = await res.text();

                const match = html.match(/src="\/\/i\.imgflip\.com\/([^"]+)"/);

                if (match && match[1]) {
                    console.log(`Found meme for "${item.word}": https://i.imgflip.com/${match[1]}`); // Debug log
                    return {
                        word: item.word,
                        mediaUrl: `https://i.imgflip.com/${match[1]}`,
                        soundEffect: item.soundEffectId !== 'none' ? item.soundEffectId : undefined
                    };
                } else {
                    console.warn(`No meme found for "${item.word}" (Query: ${item.searchQuery})`); // Debug log
                }
            } catch (e) {
                console.error("Failed to fetch meme for", item.word, e);
            }
            return null;
        }));

        const finalOverlays = overlays.filter((o: any) => o !== null);
        console.log("Final Overlays:", finalOverlays); // Debug log

        return NextResponse.json({ overlays: finalOverlays });

    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

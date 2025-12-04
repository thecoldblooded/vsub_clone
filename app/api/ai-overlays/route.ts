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
        Analyze the following video script line by line.
        
        For EACH line of the script, I need you to identify EXACTLY ONE overlay consisting of:
        1. ONE keyword/phrase for a VISUAL overlay (Image or Video).
        2. ONE keyword/phrase for a SOUND overlay.

        Rules:
        - Generate EXACTLY one overlay per line - no more, no less.
        - Ensure a roughly 50/50 split between STATIC IMAGE memes (JPG) and ANIMATED VIDEO memes (MP4/GIF) across the entire script.
        - Every single line MUST have exactly one visual overlay and one sound overlay.
        - Choose the most impactful/funny moment in each line for the overlay.
        
        For each identified keyword, provide:
        1. The exact word/phrase from the script.
        2. A search query for imgflip.com to find a relevant meme template.
        3. The type of media: "image" or "video".
        4. A sound effect ID from the provided list. You MUST select a sound effect for every keyword.
        5. A backup search query (different from the first) in case the first one yields no results.

        Script: "${script}"

        Available Sound Effects: ${JSON.stringify(availableSounds)}

        Return a JSON array of objects with keys: "word", "searchQuery", "backupSearchQuery", "mediaType", "soundEffectId".
        Ensure the response is valid JSON. Do not include any markdown formatting or comments.
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
            console.warn("Initial JSON parse failed, attempting repair...", e);
            try {
                // Attempt to fix common JSON errors like missing quotes on keys
                // Fixes: soundEffectId": "val" -> "soundEffectId": "val"
                const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
                const repairedText = cleanText.replace(/([{,]\s*)([a-zA-Z0-9_]+)"\s*:/g, '$1"$2":');
                suggestions = JSON.parse(repairedText);
                console.log("Parsed Repaired Suggestions:", suggestions);
            } catch (repairError) {
                console.error("Failed to parse Vertex response even after repair", text);
                return NextResponse.json({ error: "Failed to parse suggestions" }, { status: 500 });
            }
        }

        // Now fetch meme URLs
        const overlays = await Promise.all(suggestions.map(async (item: any) => {
            const queries = [item.searchQuery, item.backupSearchQuery].filter(Boolean);

            for (const query of queries) {
                try {
                    let searchUrl;
                    if (item.mediaType === 'video') {
                        // Use specific GIF templates search for videos
                        searchUrl = `https://imgflip.com/memesearch?q=${encodeURIComponent(query)}&gifs_only=on`;
                    } else {
                        // Use general search for images
                        searchUrl = `https://imgflip.com/search?q=${encodeURIComponent(query)}`;
                    }

                    console.log(`Searching Imgflip (${item.mediaType}) with query "${query}": ${searchUrl}`);

                    const res = await fetch(searchUrl);
                    const html = await res.text();

                    // Regex to find meme ID from search results
                    // Matches: href="/meme/123456/Meme-Name" or href="/memetemplate/123456/Meme-Name"
                    const match = html.match(/href="\/meme(template)?\/(\d+)\/[^"]+"/);

                    if (match && match[2]) {
                        const id = match[2];
                        let mediaUrl;

                        if (item.mediaType === 'video') {
                            // Construct MP4 URL for animated templates
                            // Imgflip uses base36 IDs for the actual file URL
                            const base36Id = Number(id).toString(36);
                            mediaUrl = `https://i.imgflip.com/${base36Id}.mp4`;
                        } else {
                            // Construct JPG URL for static templates
                            // Try to find the src in the search result first
                            const imgMatch = html.match(new RegExp(`src="//i\\.imgflip\\.com\\/([^"]+)"`));
                            if (imgMatch && imgMatch[1]) {
                                mediaUrl = `https://i.imgflip.com/${imgMatch[1]}`;
                            } else {
                                mediaUrl = `https://i.imgflip.com/${id}.jpg`;
                            }
                        }

                        console.log(`Found ${item.mediaType} for "${item.word}": ${mediaUrl}`);
                        return {
                            word: item.word,
                            mediaUrl: mediaUrl,
                            mediaType: item.mediaType,
                            soundEffect: item.soundEffectId !== 'none' ? item.soundEffectId : undefined
                        };
                    } else {
                        console.warn(`No meme found for "${item.word}" (Query: ${query})`);
                    }
                } catch (e) {
                    console.error("Failed to fetch meme for", item.word, e);
                }
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

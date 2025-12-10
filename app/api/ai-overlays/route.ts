import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/vertex";

export async function POST(req: Request) {
    try {
        const { sentences, availableSounds, ignoreConstraints } = await req.json();

        if (!sentences || !Array.isArray(sentences)) {
            return NextResponse.json({ error: "Sentences array is required" }, { status: 400 });
        }

        const processedLines = sentences.map((s: any) => {
            const cleanText = s.text.trim();
            if (!cleanText) return null;

            const words = cleanText.split(/\s+/);
            const count = words.length;

            // Rule 1: Skip sentences with 4 words or less (unless ignoring constraints)
            if (!ignoreConstraints && count <= 4) return null;

            let limit;
            // Rule 2: For 5-10 words, look at first 5
            if (count <= 10) {
                limit = 5;
            } else {
                // Rule 3: For >10 words, look at first half
                limit = Math.floor(count / 2);
            }

            const truncatedText = words.slice(0, limit).join(' ');

            return {
                id: s.id,
                text: truncatedText
            };
        }).filter((s: any) => s !== null);

        if (processedLines.length === 0) {
            return NextResponse.json({ overlays: [] });
        }

        const accessToken = await getAccessToken();
        const projectId = process.env.GOOGLE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "vsub-clone";
        const modelId = "gemini-2.5-pro";
        const apiKey = process.env.GEMINI_API_KEY;

        const prompt = `
        Analyze the following video script sentences. I will provide them as a JSON array of objects with "id" and "text".
        
        For EACH sentence, I need you to identify a PRIMARY option and a FALLBACK option for an overlay.
        The overlay can be either a VISUAL overlay (Image or Video) + SOUND overlay.

        Rules:
        - Generate EXACTLY ONE object per input sentence.
        - The output object must include the "sentenceId" from the input.
        - Ensure a roughly 50/50 split between STATIC IMAGE memes (JPG) and ANIMATED VIDEO memes (MP4/GIF) across the whole set.
        - "mediaType" must be either "image" or "video".
        
        For each option (Primary and Fallback):
        1. Choose a viral/impactful word or phrase from the segment.
        2. Provide 3 DISTINCT search queries for imgflip.com.
           - Query 1: Specific/Exact match.
           - Query 2: broader/thematic match.
           - Query 3: Generic/Emotional match.
        3. Select a sound effect ID.

        Input Sentences: ${JSON.stringify(processedLines)}

        Available Sound Effects: ${JSON.stringify(availableSounds)}

        Return ONLY a raw JSON array of objects. Do not use markdown code blocks.
        
        Expected JSON Structure:
        [
          {
            "sentenceId": "string (from input)",
            "mediaType": "image" | "video",
            "primary": {
              "word": "string (exact text from script)",
              "queries": ["query1", "query2", "query3"],
              "soundEffectId": "string"
            },
            "fallback": {
               "word": "string (different text from script if possible)",
               "queries": ["query1", "query2", "query3"],
               "soundEffectId": "string"
            }
          }
        ]
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
        console.log("Vertex AI Response Data:", JSON.stringify(data, null, 2));

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
            console.error("Vertex AI returned no text in candidates");
            return NextResponse.json({ overlays: [] });
        }

        let suggestions = [];
        try {
            // Robust JSON extraction
            let cleanText = text.trim();
            cleanText = cleanText.replace(/```json/g, '').replace(/```/g, '');
            const firstBracket = cleanText.indexOf('[');
            const lastBracket = cleanText.lastIndexOf(']');
            if (firstBracket !== -1 && lastBracket !== -1) {
                cleanText = cleanText.substring(firstBracket, lastBracket + 1);
            }
            suggestions = JSON.parse(cleanText);
        } catch (e) {
            console.warn("Initial JSON parse failed, attempting repair...", e);
            try {
                const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
                const repairedText = cleanText.replace(/([{,]\s*)([a-zA-Z0-9_]+)"\s*:/g, '$1"$2":');
                suggestions = JSON.parse(repairedText);
            } catch (repairError) {
                console.error("Failed to parse Vertex response", text);
                return NextResponse.json({ error: "Failed to parse suggestions" }, { status: 500 });
            }
        }

        // Helper function to try finding a meme
        const findMeme = async (queries: string[], mediaType: 'image' | 'video', word: string) => {
            for (const query of queries) {
                if (!query) continue;
                try {
                    let searchUrl;
                    if (mediaType === 'video') {
                        searchUrl = `https://imgflip.com/memesearch?q=${encodeURIComponent(query)}&gifs_only=on`;
                    } else {
                        searchUrl = `https://imgflip.com/search?q=${encodeURIComponent(query)}`;
                    }

                    console.log(`Searching Imgflip (${mediaType}) for "${word}" with query "${query}": ${searchUrl}`);

                    const res = await fetch(searchUrl);
                    const html = await res.text();

                    // Regex to find meme ID
                    const match = html.match(/href="\/meme(template)?\/(\d+)\/[^"]+"/);

                    if (match && match[2]) {
                        const id = match[2];
                        let mediaUrl;

                        if (mediaType === 'video') {
                            const base36Id = Number(id).toString(36);
                            mediaUrl = `https://i.imgflip.com/${base36Id}.mp4`;
                        } else {
                            const imgMatch = html.match(new RegExp(`src="//i\\.imgflip\\.com\\/([^"]+)"`));
                            if (imgMatch && imgMatch[1]) {
                                mediaUrl = `https://i.imgflip.com/${imgMatch[1]}`;
                            } else {
                                mediaUrl = `https://i.imgflip.com/${id}.jpg`;
                            }
                        }

                        console.log(`Found ${mediaType} for "${word}": ${mediaUrl}`);
                        return mediaUrl;
                    }
                } catch (e) {
                    console.error("Error fetching meme:", e);
                }
            }
            return null;
        };

        // Process suggestions
        const overlays = await Promise.all(suggestions.map(async (item: any) => {
            // Helper to add word to queries if strictly needed (as last resort)
            const enhanceQueries = (queries: string[], word: string) => {
                const cleanWord = word.replace(/[^a-zA-Z0-9 ]/g, '');
                if (!queries.includes(cleanWord)) return [...queries, cleanWord];
                return queries;
            };

            // Try Primary
            if (item.primary) {
                const qt = item.primary.queries || [];
                const finalQueries = enhanceQueries(qt, item.primary.word);
                const url = await findMeme(finalQueries, item.mediaType, item.primary.word);
                if (url) {
                    return {
                        sentenceId: item.sentenceId,
                        word: item.primary.word,
                        mediaUrl: url,
                        mediaType: item.mediaType,
                        soundEffect: item.primary.soundEffectId !== 'none' ? item.primary.soundEffectId : undefined
                    };
                }
            }

            // Try Fallback
            console.warn(`Primary failed for concept. Trying fallback...`);
            if (item.fallback) {
                const qt = item.fallback.queries || [];
                const finalQueries = enhanceQueries(qt, item.fallback.word);
                const url = await findMeme(finalQueries, item.mediaType, item.fallback.word);
                if (url) {
                    return {
                        sentenceId: item.sentenceId,
                        word: item.fallback.word,
                        mediaUrl: url,
                        mediaType: item.mediaType,
                        soundEffect: item.fallback.soundEffectId !== 'none' ? item.fallback.soundEffectId : undefined
                    };
                }
            }

            console.warn("All attempts failed for this segment.");
            return null;
        }));

        const finalOverlays = overlays.filter((o: any) => o !== null);
        console.log("Final Overlays:", finalOverlays);

        return NextResponse.json({ overlays: finalOverlays });

    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

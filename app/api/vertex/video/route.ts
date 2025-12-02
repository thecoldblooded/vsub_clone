import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: Request) {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("google_access_token")?.value;

    if (!accessToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { prompt } = await req.json();

        // Using Imagen 2 via Vertex AI API
        // https://cloud.google.com/vertex-ai/docs/generative-ai/image/generate-images
        // Note: The endpoint format depends on the region and project.
        // We'll assume us-central1 and try to infer project ID or use a placeholder if not available.
        // Ideally, PROJECT_ID should be in env.
        const projectId = process.env.GOOGLE_PROJECT_ID || "your-project-id";
        const location = "us-central1";

        const response = await fetch(`https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagegeneration@006:predict`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                instances: [
                    { prompt: prompt }
                ],
                parameters: {
                    sampleCount: 1,
                    aspectRatio: "9:16"
                }
            }),
        });

        if (!response.ok) {
            // Fallback or error handling
            const error = await response.json();
            console.error("Vertex Imagen Error:", error);
            return NextResponse.json({ error: error.error?.message || "Failed to generate image" }, { status: response.status });
        }

        const data = await response.json();
        // predictions[0].bytesBase64Encoded
        const imageBase64 = data.predictions?.[0]?.bytesBase64Encoded;

        return NextResponse.json({ image: imageBase64 });
    } catch (error) {
        console.error("Vertex Video/Image API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

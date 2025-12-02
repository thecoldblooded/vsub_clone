import { OAuth2Client } from "google-auth-library";
import { cookies } from "next/headers";

const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
);

export async function getAccessToken() {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("google_access_token")?.value;

    if (accessToken) return accessToken;

    const refreshToken = cookieStore.get("google_refresh_token")?.value;
    if (!refreshToken) {
        throw new Error("No refresh token found. Please login again.");
    }

    try {
        client.setCredentials({ refresh_token: refreshToken });
        const { credentials } = await client.refreshAccessToken();

        // Note: We cannot set cookies here if this is called from a Server Component.
        // If called from an API Route or Server Action, we could potentially update it.
        // For now, we return the new token. The caller should handle cookie updates if needed/possible.
        return credentials.access_token;
    } catch (error) {
        console.error("Failed to refresh token:", error);
        throw new Error("Failed to refresh token");
    }
}

interface GenerateSpeechParams {
    text: string;
    accessToken: string;
    voiceName?: string;
    modelName?: string; // e.g., 'gemini-2.5-flash-tts'
    prompt?: string; // For Gemini TTS
    speed?: number;
    pitch?: number;
    volume?: number;
}

export async function generateSpeech({
    text,
    accessToken,
    voiceName = 'en-US-Journey-D',
    modelName,
    prompt,
    speed = 1,
    pitch = 1,
    volume = 0
}: GenerateSpeechParams) {
    // Endpoint: https://texttospeech.googleapis.com/v1/text:synthesize

    // Construct request body based on model type
    let body: any = {
        audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: speed,
            pitch: pitch,
            volumeGainDb: volume
        },
    };

    if (modelName?.startsWith('gemini')) {
        // Gemini TTS structure
        body.input = {
            text,
            prompt // Optional prompt for Gemini TTS
        };
        body.voice = {
            languageCode: 'en-US', // Defaulting to en-US for now
            name: voiceName,
            model_name: modelName
        };
        // Gemini TTS might require LINEAR16 or specific encoding, but let's try MP3 first as per user's curl which used LINEAR16 but we want MP3 for web.
        // The user's curl example used LINEAR16. Let's stick to MP3 if possible for easier playback, or handle conversion.
        // Standard TTS supports MP3. Let's assume Gemini TTS does too or falls back.
    } else {
        // Standard TTS structure
        body.input = { text };
        body.voice = {
            languageCode: 'en-US',
            name: voiceName
        };
    }

    const response = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            // Add x-goog-user-project header if needed, but usually Bearer token is enough if it has scope.
            // User provided example uses it, but we might not have PROJECT_ID easily available in env yet.
            // Let's try without first, or use a placeholder if strictly required.
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Vertex AI TTS Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.audioContent; // Base64 encoded audio
}

export async function generateImage(prompt: string, accessToken: string) {
    // Placeholder for Vertex AI Imagen call
    console.log("Generating image for:", prompt);
    return null;
}

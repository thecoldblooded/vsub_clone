import { OAuth2Client } from "google-auth-library";
import { NextResponse } from "next/server";

const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "http://localhost:3000/api/auth/callback/google"
);

export async function GET() {
    console.log("Signin Route - Client ID:", process.env.GOOGLE_CLIENT_ID ? "Set" : "Missing");
    console.log("Signin Route - Client Secret:", process.env.GOOGLE_CLIENT_SECRET ? "Set" : "Missing");

    const authorizeUrl = client.generateAuthUrl({
        access_type: 'offline',
        scope: [
            'https://www.googleapis.com/auth/cloud-platform', // For Vertex AI
            'https://www.googleapis.com/auth/generative-language.retriever', // For Gemini API
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile'
        ],
        prompt: 'consent' // Force consent to ensure we get a refresh token
    });

    console.log("Generated Auth URL:", authorizeUrl);

    return NextResponse.redirect(authorizeUrl);
}

import { OAuth2Client } from "google-auth-library";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "http://localhost:3000/api/auth/callback/google"
);

export async function GET(req: Request) {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");

    if (!code) {
        return NextResponse.json({ error: "No code provided" }, { status: 400 });
    }

    try {
        const { tokens } = await client.getToken(code);

        const cookieStore = await cookies();

        // Store tokens in HTTP-only cookie
        cookieStore.set("google_access_token", tokens.access_token || "", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 3600, // 1 hour
            path: "/",
        });

        if (tokens.refresh_token) {
            cookieStore.set("google_refresh_token", tokens.refresh_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                maxAge: 60 * 60 * 24 * 30, // 30 days
                path: "/",
            });
        }

        // Set a non-httpOnly cookie for client-side UI checks
        cookieStore.set("google_auth_status", "true", {
            httpOnly: false,
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24 * 30, // 30 days
            path: "/",
        });

        return NextResponse.redirect(new URL("/jobs", req.url));
    } catch (error) {
        console.error("OAuth Error:", error);
        return NextResponse.json({ error: "Failed to exchange code" }, { status: 500 });
    }
}

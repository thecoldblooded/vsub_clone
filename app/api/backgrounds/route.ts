import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const backgroundsDir = path.join(process.cwd(), 'public', 'backgrounds');

        if (!fs.existsSync(backgroundsDir)) {
            return NextResponse.json({ videos: [] });
        }

        const files = fs.readdirSync(backgroundsDir);
        const videos = files.filter(file => file.endsWith('.mp4'));

        return NextResponse.json({ videos });
    } catch (error) {
        console.error('Error listing backgrounds:', error);
        return NextResponse.json({ error: 'Failed to list backgrounds' }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    try {
        const ffmpegPath = require('ffmpeg-static')

        return NextResponse.json({
            success: true,
            ffmpegPath: ffmpegPath,
            platform: process.platform,
            arch: process.arch,
            tmpdir: require('os').tmpdir()
        })
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : null
        })
    }
}

import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'

export async function GET(request: NextRequest) {
    try {
        // Try to find ffmpeg in node_modules using process.cwd()
        const projectRoot = process.cwd()
        const ffmpegPath = path.join(projectRoot, 'node_modules', 'ffmpeg-static', 'ffmpeg.exe')

        const exists = fs.existsSync(ffmpegPath)

        return NextResponse.json({
            success: true,
            method: 'process.cwd()',
            projectRoot: projectRoot,
            resolvedPath: ffmpegPath,
            exists: exists
        })
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : null
        })
    }
}

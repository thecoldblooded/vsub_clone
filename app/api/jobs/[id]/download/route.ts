import { NextRequest, NextResponse } from 'next/server'
import { getJob } from '@/lib/jobs'
import path from 'path'
import fs from 'fs'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params
    const job = getJob(resolvedParams.id)

    if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (job.status !== 'COMPLETED' || !job.resultUrl) {
        return NextResponse.json({ error: 'Job not completed' }, { status: 400 })
    }

    // resultUrl is like /videos/job-xxx.mp4
    const filename = path.basename(job.resultUrl)
    const filePath = path.join(process.cwd(), 'public', 'videos', filename)

    if (!fs.existsSync(filePath)) {
        console.error(`File not found at path: ${filePath}`)
        return NextResponse.json({ error: 'File not found on server' }, { status: 404 })
    }

    try {
        const stat = fs.statSync(filePath)
        const fileSize = stat.size
        const downloadFilename = job.metadata?.originalName || filename

        // Create a Node stream
        const fileStream = fs.createReadStream(filePath)

        // Convert to Web Stream for NextResponse
        const stream = new ReadableStream({
            start(controller) {
                fileStream.on('data', (chunk) => controller.enqueue(chunk))
                fileStream.on('end', () => controller.close())
                fileStream.on('error', (err) => controller.error(err))
            }
        })

        const encodedFilename = encodeURIComponent(downloadFilename)

        return new NextResponse(stream, {
            headers: {
                'Content-Type': filename.endsWith('.webm') ? 'video/webm' : 'video/mp4',
                'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
                'Content-Length': fileSize.toString()
            }
        })
    } catch (e) {
        console.error("Download failed:", e)
        return NextResponse.json({ error: 'Download failed' }, { status: 500 })
    }
}

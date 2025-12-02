import { NextRequest, NextResponse } from 'next/server'
import { updateJob, getJob } from '@/lib/jobs'
import path from 'path'
import { promises as fs } from 'fs'

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params
        const id = resolvedParams.id
        const body = await request.json()

        const job = getJob(id)
        if (!job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 })
        }

        // Allow updating specific fields
        const allowedUpdates = ['status', 'progress', 'error', 'resultUrl', 'startedAt', 'finishedAt', 'metadata']
        const updates: any = {}

        for (const key of allowedUpdates) {
            if (body[key] !== undefined) {
                updates[key] = body[key]
            }
        }

        // Auto-set finishedAt if status becomes COMPLETED or FAILED
        if ((updates.status === 'COMPLETED' || updates.status === 'FAILED') && !updates.finishedAt) {
            updates.finishedAt = new Date().toISOString()
        }

        // Auto-set startedAt if status becomes PROCESSING (or GENERATING if we consider that start)
        // Let's say startedAt is when it enters GENERATING or PROCESSING for the first time
        if ((updates.status === 'GENERATING' || updates.status === 'PROCESSING') && !job.startedAt) {
            updates.startedAt = new Date().toISOString()
        }

        const updatedJob = updateJob(id, updates)
        return NextResponse.json(updatedJob)

    } catch (error) {
        console.error("Failed to update job:", error)
        return NextResponse.json({ error: 'Failed to update job' }, { status: 500 })
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const resolvedParams = await params
    const job = getJob(resolvedParams.id)
    if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    return NextResponse.json(job)
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params
        const id = resolvedParams.id

        // 1. Get Job to find the file path
        const job = getJob(id)
        if (!job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 })
        }

        // 2. Delete file if it exists
        if (job.resultUrl) {
            try {
                const filename = path.basename(job.resultUrl)
                const filePath = path.join(process.cwd(), 'public', 'videos', filename)
                await fs.unlink(filePath)
                console.log(`Deleted file: ${filePath}`)
            } catch (e) {
                console.warn(`Failed to delete file for job ${id}:`, e)
                // Continue to delete job record even if file deletion fails
            }
        }

        // 3. Delete Associated Project
        if (job.metadata?.projectId) {
            try {
                const { deleteProject } = await import('@/lib/projects')
                deleteProject(job.metadata.projectId)
                console.log(`Deleted associated project: ${job.metadata.projectId}`)
            } catch (e) {
                console.warn(`Failed to delete project ${job.metadata.projectId}:`, e)
            }
        }

        // 4. Delete Uploaded Files (Background & Thumbnail)
        const filesToDelete = []
        if (job.metadata?.backgroundVideo?.startsWith('/uploads/')) {
            filesToDelete.push(job.metadata.backgroundVideo)
        }
        if (job.metadata?.backgroundThumbnail?.startsWith('/uploads/')) {
            filesToDelete.push(job.metadata.backgroundThumbnail)
        }

        for (const fileUrl of filesToDelete) {
            try {
                const filename = path.basename(fileUrl)
                const filePath = path.join(process.cwd(), 'public', 'uploads', filename)
                await fs.unlink(filePath)
                console.log(`Deleted uploaded file: ${filePath}`)
            } catch (e) {
                console.warn(`Failed to delete uploaded file ${fileUrl}:`, e)
            }
        }

        // 3. Delete Job Record
        const { deleteJob } = await import('@/lib/jobs')
        const success = deleteJob(id)

        if (!success) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Failed to delete job:", error)
        return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 })
    }
}

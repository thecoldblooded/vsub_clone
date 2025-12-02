import { NextRequest, NextResponse } from 'next/server'
import { createJob, updateJob, getJobs, saveJobs, getJob } from '@/lib/jobs'
import path from 'path'
import { promises as fs } from 'fs'
import fsSync from 'fs'
import { tmpdir } from 'os'
import JSZip from 'jszip'
import ffmpeg from 'fluent-ffmpeg'

// FFmpeg path resolution
let ffmpegPath: string | null = null
try {
    const projectRoot = process.cwd()
    ffmpegPath = path.join(projectRoot, 'node_modules', 'ffmpeg-static', 'ffmpeg.exe')
    if (fsSync.existsSync(ffmpegPath)) {
        ffmpeg.setFfmpegPath(ffmpegPath)
    } else {
        console.error('❌ FFmpeg binary not found at:', ffmpegPath)
        ffmpegPath = null
    }
} catch (e) {
    console.error('❌ FFmpeg setup failed:', e)
}

export async function GET(request: NextRequest) {
    // In a real app, filter by userId from session
    // For now, return all jobs or filter by query param
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    let jobs = getJobs()
    if (userId) {
        jobs = jobs.filter(j => j.userId === userId)
    }

    return NextResponse.json(jobs)
}

export async function DELETE(request: NextRequest) {
    try {
        const jobs = getJobs()

        // Delete all files
        // Delete all files and associated resources
        for (const job of jobs) {
            // 1. Delete Result File
            if (job.resultUrl) {
                try {
                    const filename = path.basename(job.resultUrl)
                    const filePath = path.join(process.cwd(), 'public', 'videos', filename)
                    await fs.unlink(filePath)
                    console.log(`Deleted file: ${filePath}`)
                } catch (e) {
                    console.warn(`Failed to delete file for job ${job.id}:`, e)
                }
            }

            // 2. Delete Associated Project
            if (job.metadata?.projectId) {
                try {
                    const { deleteProject } = await import('@/lib/projects')
                    deleteProject(job.metadata.projectId)
                    console.log(`Deleted associated project: ${job.metadata.projectId}`)
                } catch (e) {
                    console.warn(`Failed to delete project ${job.metadata.projectId}:`, e)
                }
            }

            // 3. Delete Uploaded Files
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
        }

        // Clear all jobs
        saveJobs([])

        return NextResponse.json({ success: true, count: jobs.length })
    } catch (error) {
        console.error("Failed to delete all jobs:", error)
        return NextResponse.json({ error: 'Failed to delete all jobs' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const contentType = request.headers.get('content-type') || ''

        // Case 1: Create Job (JSON)
        if (contentType.includes('application/json')) {
            const body = await request.json()
            const userId = body.userId || 'anonymous'
            const job = createJob('VIDEO_EXPORT', userId, {
                originalName: body.originalName || 'video.mp4'
            })
            // Set status to GENERATING if requested
            if (body.status === 'GENERATING') {
                updateJob(job.id, { status: 'GENERATING' })
            }
            return NextResponse.json({ jobId: job.id })
        }

        // Case 2: Upload File (FormData)
        const formData = await request.formData()
        const zipFile = formData.get('file') as File
        const userId = (formData.get('userId') as string) || 'anonymous'
        const existingJobId = formData.get('jobId') as string
        const originalName = (formData.get('originalName') as string) || zipFile.name

        if (!zipFile) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        let jobId = existingJobId

        if (jobId) {
            // Update existing job
            updateJob(jobId, {
                status: 'PROCESSING',
                progress: 0,
                metadata: {
                    originalName: originalName,
                    size: zipFile.size
                }
            })
        } else {
            // Create new job (legacy)
            const job = createJob('VIDEO_EXPORT', userId, {
                originalName: originalName,
                size: zipFile.size
            })
            jobId = job.id
        }

        // Start background processing WITHOUT awaiting
        processJob(jobId, zipFile)

        return NextResponse.json({ jobId })

    } catch (error) {
        console.error("Job creation failed:", error)
        return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
    }
}

// Background Processor
async function processJob(jobId: string, zipFile: File) {
    const tempDir = path.join(tmpdir(), `job-${jobId}`)

    try {
        updateJob(jobId, { status: 'PROCESSING', progress: 5 })

        await fs.mkdir(tempDir, { recursive: true })

        // Save Zip
        const zipBuffer = Buffer.from(await zipFile.arrayBuffer())
        const zipPath = path.join(tempDir, 'upload.zip')
        await fs.writeFile(zipPath, zipBuffer)

        // Extract Zip
        updateJob(jobId, { progress: 10 })
        const zip = await JSZip.loadAsync(zipBuffer)

        // Extract all files
        const keys = Object.keys(zip.files)
        for (const filename of keys) {
            if (!zip.files[filename].dir) {
                const content = await zip.files[filename].async('nodebuffer')
                const destPath = path.join(tempDir, filename)
                await fs.writeFile(destPath, content)
            }
        }

        updateJob(jobId, { progress: 20 })


        // Read metadata if available (or infer from files)
        // We expect frames as frameXXXXX.jpg (or .png) and audio as audioX.mp3
        const files = await fs.readdir(tempDir)
        console.log(`[Job ${jobId}] Extracted ${files.length} files to ${tempDir}`)

        const frameFiles = files.filter(f => f.startsWith('frame') && (f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.webp'))).sort()
        const audioFiles = files.filter(f => (f.startsWith('audio') || f.startsWith('tts_') || f.startsWith('sfx_')) && f.endsWith('.mp3')).sort()
        const backgroundVideo = files.find(f => f === 'background.mp4')

        console.log(`[Job ${jobId}] Found ${frameFiles.length} frame files, ${audioFiles.length} audio files, Background: ${backgroundVideo}`)

        if (frameFiles.length === 0) {
            console.error(`[Job ${jobId}] NO FRAME FILES FOUND! All files:`, files.slice(0, 10))
            throw new Error(`No frame files found in zip. Expected .jpg or .png files starting with 'frame'`)
        }

        // Parse metadata
        let metadata = {
            fps: 30,
            duration: 0,
            format: 'mp4',
            mode: 'standard', // 'standard' or 'overlay'
            audioTracks: [] as { filename: string, startTime: number }[]
        }

        if (keys.includes('metadata.json')) {
            const metaContent = await zip.files['metadata.json'].async('string')
            try {
                const parsed = JSON.parse(metaContent)
                metadata = { ...metadata, ...parsed }

                // CRITICAL: Save metadata to job record so we can delete files later
                updateJob(jobId, {
                    metadata: {
                        ...metadata,
                        // Ensure we preserve originalName and size if they exist
                        originalName: (getJob(jobId)?.metadata as any)?.originalName,
                        size: (getJob(jobId)?.metadata as any)?.size
                    }
                })
            } catch (e) {
                console.error("Failed to parse metadata.json", e)
            }
        }

        const isWebM = metadata.format === 'webm'
        const outputExt = isWebM ? 'webm' : 'mp4'
        const outputPath = path.join(tempDir, `output.${outputExt}`)

        // Prepare Audio
        updateJob(jobId, { progress: 30 })
        const mergedAudioPath = path.join(tempDir, 'merged.mp3')

        // If overlay mode and background video exists, extract its audio
        if (metadata.mode === 'overlay' && backgroundVideo) {
            console.log(`[Job ${jobId}] Extracting audio from background video...`)
            const bgAudioPath = path.join(tempDir, 'background_audio.mp3')
            try {
                await new Promise<void>((resolve, reject) => {
                    ffmpeg(path.join(tempDir, backgroundVideo))
                        .noVideo()
                        .audioCodec('libmp3lame')
                        .save(bgAudioPath)
                        .on('end', () => resolve())
                        .on('error', (err) => {
                            console.warn("Background audio extraction failed (might be silent):", err)
                            resolve() // Continue without background audio
                        })
                })

                if (fsSync.existsSync(bgAudioPath)) {
                    // Add to audio tracks at time 0
                    metadata.audioTracks.unshift({ filename: 'background_audio.mp3', startTime: 0 })
                }
            } catch (e) {
                console.warn("Error processing background audio:", e)
            }
        }

        // Merge Audio Tracks
        let hasAudio = false
        if (metadata.audioTracks && metadata.audioTracks.length > 0) {
            const audioInputs: string[] = []
            const filterComplex: string[] = []

            metadata.audioTracks.forEach((track, i) => {
                const audioPath = path.join(tempDir, track.filename)
                if (fsSync.existsSync(audioPath)) {
                    audioInputs.push(audioPath)
                    const startTimeMs = Math.round(track.startTime * 1000)
                    // adelay adds delay to all channels. | delimiter separates per channel.
                    filterComplex.push(`[${i}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,adelay=${startTimeMs}|${startTimeMs}[a${i}]`)
                }
            })

            if (audioInputs.length > 0) {
                hasAudio = true
                if (audioInputs.length === 1) {
                    // Just copy if only 1 input (e.g. just background audio)
                    // But we still need to apply delay if it's not 0, though usually single track is 0
                    // Actually, filterComplex logic above handles delay.
                    // If 1 input, just map [a0] to output
                    filterComplex.push(`[a0]volume=1[aout]`)
                } else {
                    const mixInputs = audioInputs.map((_, i) => `[a${i}]`).join('')
                    filterComplex.push(`${mixInputs}amix=inputs=${audioInputs.length}:duration=longest:dropout_transition=0:normalize=0[aout]`)
                }

                await new Promise<void>((resolve, reject) => {
                    const cmd = ffmpeg()
                    audioInputs.forEach(input => cmd.input(input))
                    cmd.complexFilter(filterComplex, 'aout')
                        .output(mergedAudioPath)
                        .on('end', () => resolve())
                        .on('error', (err) => reject(err))
                        .run()
                })
            }
        }

        updateJob(jobId, { progress: 50 })

        // Encode Video
        await new Promise<void>((resolve, reject) => {
            if (!ffmpegPath) return reject(new Error("FFmpeg not found"))

            const cmd = ffmpeg()

            cmd.on('start', (commandLine) => {
                console.log(`[Job ${jobId}] Spawned Ffmpeg with command: ${commandLine}`)
            })

            // Determine frame extension from the first found file
            const firstFrame = frameFiles[0]
            const frameExt = path.extname(firstFrame).substring(1) // 'jpg' or 'png'

            if (metadata.mode === 'overlay' && backgroundVideo) {
                // Overlay Mode
                console.log(`[Job ${jobId}] Encoding in OVERLAY mode`)
                cmd.input(path.join(tempDir, backgroundVideo)) // Input 0
                cmd.input(path.join(tempDir, `frame%05d.${frameExt}`)) // Input 1
                    .inputOptions(['-framerate', metadata.fps.toString()])

                // Use format filter with alpha to ensure transparency works
                cmd.complexFilter([
                    '[1:v]format=rgba[ovr]',
                    '[0:v][ovr]overlay=format=auto:shortest=1[outv]'
                ])

                // Audio
                if (hasAudio && fsSync.existsSync(mergedAudioPath)) {
                    cmd.input(mergedAudioPath)
                    cmd.outputOptions(['-map', '[outv]', '-map', '2:a']) // Map overlay output and merged audio
                } else {
                    cmd.outputOptions(['-map', '[outv]'])
                }

            } else {
                // Standard Mode (Frames only)
                console.log(`[Job ${jobId}] Encoding in STANDARD mode`)
                cmd.input(path.join(tempDir, `frame%05d.${frameExt}`))
                    .inputOptions(['-framerate', metadata.fps.toString()])

                if (hasAudio && fsSync.existsSync(mergedAudioPath)) {
                    cmd.input(mergedAudioPath)
                }
            }

            // Output Options
            if (isWebM) {
                cmd.outputOptions([
                    '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '2M', '-auto-alt-ref', '0', '-c:a', 'libvorbis'
                ])
            } else {
                cmd.outputOptions([
                    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k'
                ])
            }

            cmd.duration(metadata.duration)
                .output(outputPath)
                .on('progress', (p) => {
                    if (p.percent) {
                        const progress = 50 + Math.round(p.percent * 0.4)
                        updateJob(jobId, { progress })
                    }
                })
                .on('end', () => resolve())
                .on('error', (err) => reject(err))
                .run()
        })

        updateJob(jobId, { progress: 95 })

        // Move result to public/videos or keep in a data folder?
        // Let's put it in public/videos for easy access
        const publicDir = path.join(process.cwd(), 'public', 'videos')
        await fs.mkdir(publicDir, { recursive: true })
        const finalFilename = `job-${jobId}.${outputExt}`
        const finalPath = path.join(publicDir, finalFilename)

        await fs.copyFile(outputPath, finalPath)

        updateJob(jobId, {
            status: 'COMPLETED',
            progress: 100,
            resultUrl: `/videos/${finalFilename}`
        })

    } catch (error) {
        console.error(`Job ${jobId} failed:`, error)
        updateJob(jobId, {
            status: 'FAILED',
            error: error instanceof Error ? error.message : String(error)
        })
    } finally {
        // Cleanup
        try {
            await fs.rm(tempDir, { recursive: true, force: true })
        } catch (e) {
            console.error("Cleanup failed:", e)
        }
    }
}

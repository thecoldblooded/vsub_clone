import { NextRequest, NextResponse } from 'next/server'
import ffmpeg from 'fluent-ffmpeg'
import { promises as fs } from 'fs'
import fsSync from 'fs'
import path from 'path'
import { tmpdir } from 'os'

// FFmpeg path resolution using process.cwd()
let ffmpegPath: string | null = null
try {
    const projectRoot = process.cwd()
    ffmpegPath = path.join(projectRoot, 'node_modules', 'ffmpeg-static', 'ffmpeg.exe')
    console.log('🔧 FFmpeg path:', ffmpegPath)

    // Check if it exists
    if (fsSync.existsSync(ffmpegPath)) {
        ffmpeg.setFfmpegPath(ffmpegPath)
    } else {
        console.error('❌ FFmpeg binary not found at:', ffmpegPath)
        ffmpegPath = null
    }
} catch (e) {
    console.error('❌ FFmpeg setup failed:', e)
}

export async function POST(request: NextRequest) {
    try {
        // Verify FFmpeg is available
        if (!ffmpegPath) {
            throw new Error('FFmpeg not configured - path resolution failed')
        }

        // Parse FormData
        const formData = await request.formData()

        const frameFiles = formData.getAll('frames') as File[]
        const audioFiles = formData.getAll('audio') as File[]
        const duration = parseFloat(formData.get('duration') as string)
        const fps = parseInt(formData.get('fps') as string)
        const audioCount = parseInt(formData.get('audioCount') as string)
        const format = (formData.get('format') as string) || 'mp4'
        const isWebM = format === 'webm'

        console.log(`✅ Received: ${frameFiles.length} frames, ${audioFiles.length} audio, ${duration}s, ${fps} FPS`)

        // Create temp directory
        const tempDir = path.join(tmpdir(), `video-export-${Date.now()}`)
        await fs.mkdir(tempDir, { recursive: true })
        console.log(`📁 Temp dir: ${tempDir}`)

        // Save frames
        console.log('💾 Saving frames...')
        for (let i = 0; i < frameFiles.length; i++) {
            const buffer = Buffer.from(await frameFiles[i].arrayBuffer())
            const framePath = path.join(tempDir, `frame${i.toString().padStart(5, '0')}.webp`)
            await fs.writeFile(framePath, buffer)

            if (i % 30 === 0) console.log(`  ${i}/${frameFiles.length}`)
        }
        console.log('✅ Frames saved')

        // Save audio
        console.log('🎵 Saving audio...')
        for (let i = 0; i < audioFiles.length; i++) {
            const buffer = Buffer.from(await audioFiles[i].arrayBuffer())
            const audioPath = path.join(tempDir, `audio${i}.mp3`)
            await fs.writeFile(audioPath, buffer)
        }
        console.log(`✅ Saved ${audioFiles.length} audio`)

        // Merge audio using complex filter (adelay + amix)
        const mergedAudioPath = path.join(tempDir, 'merged.mp3')

        if (audioFiles.length > 0) {
            console.log('🎶 Merging audio with complex filter...')

            const audioInputs: string[] = []
            const filterComplex: string[] = []

            for (let i = 0; i < audioFiles.length; i++) {
                const startTimeMs = Math.round(parseFloat(formData.get(`audioStartTime${i}`) as string) * 1000)
                audioInputs.push(path.join(tempDir, `audio${i}.mp3`))

                // Force stereo, 44.1kHz, float format, THEN add delay
                // This prevents issues with mixing mono/stereo or different sample rates
                filterComplex.push(`[${i}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,adelay=${startTimeMs}|${startTimeMs}[a${i}]`)
            }

            // Mix all delayed audio streams
            if (audioInputs.length === 1) {
                // If only one input, just pass it through (using volume=1 as a no-op filter)
                filterComplex.push(`[a0]volume=1[aout]`)
            } else {
                // Use duration=longest to ensure we don't cut off audio if the first track is short
                const mixInputs = audioInputs.map((_, i) => `[a${i}]`).join('')
                filterComplex.push(`${mixInputs}amix=inputs=${audioInputs.length}:duration=longest:dropout_transition=0:normalize=0[aout]`)
            }

            console.log('Filter:', filterComplex.join(';'))

            await new Promise<void>((resolve, reject) => {
                const cmd = ffmpeg()

                audioInputs.forEach(input => cmd.input(input))

                cmd.complexFilter(filterComplex, 'aout')
                    .output(mergedAudioPath)
                    .on('end', () => {
                        console.log('✅ Audio merged')
                        resolve()
                    })
                    .on('error', (err: any) => {
                        console.error('❌ Audio error:', err.message)
                        reject(err)
                    })
                    .run()
            })
        }

        // Encode video
        console.log(`🎬 Encoding to ${format}...`)
        const outputExt = isWebM ? 'webm' : 'mp4'
        const outputPath = path.join(tempDir, `output.${outputExt}`)

        await new Promise<void>((resolve, reject) => {
            const cmd = ffmpeg()
                .input(path.join(tempDir, 'frame%05d.webp'))
                .inputOptions(['-framerate', fps.toString()])

            if (audioFiles.length > 0) {
                cmd.input(mergedAudioPath)

                if (isWebM) {
                    cmd.outputOptions([
                        '-c:v', 'libvpx-vp9',
                        '-pix_fmt', 'yuva420p',
                        '-b:v', '2M',
                        '-auto-alt-ref', '0',
                        '-c:a', 'libvorbis'
                    ])
                } else {
                    cmd.outputOptions([
                        '-c:v', 'libx264',
                        '-preset', 'ultrafast',
                        '-crf', '23',
                        '-pix_fmt', 'yuv420p',
                        '-c:a', 'aac',
                        '-b:a', '192k'
                    ])
                }
            } else {
                if (isWebM) {
                    cmd.outputOptions([
                        '-c:v', 'libvpx-vp9',
                        '-pix_fmt', 'yuva420p',
                        '-b:v', '2M',
                        '-auto-alt-ref', '0'
                    ])
                } else {
                    cmd.outputOptions([
                        '-c:v', 'libx264',
                        '-preset', 'ultrafast',
                        '-crf', '23',
                        '-pix_fmt', 'yuv420p'
                    ])
                }
            }

            cmd
                .output(outputPath)
                .on('progress', (progress: any) => {
                    if (progress.percent) {
                        console.log(`  ${progress.percent.toFixed(1)}%`)
                    }
                })
                .on('end', () => {
                    console.log('✅ Encoded')
                    resolve()
                })
                .on('error', (err: any) => {
                    console.error('❌ Encode error:', err.message)
                    console.error('Stack:', err.stack)
                    reject(err)
                })
                .run()
        })

        // Read and return
        const videoBuffer = await fs.readFile(outputPath)
        console.log(`✅ Done: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`)

        await fs.rm(tempDir, { recursive: true, force: true })

        return new NextResponse(videoBuffer, {
            headers: {
                'Content-Type': isWebM ? 'video/webm' : 'video/mp4',
                'Content-Disposition': `attachment; filename="video-${Date.now()}.${outputExt}"`
            }
        })

    } catch (error) {
        console.error('❌ Export Error Details:')
        console.error('Error message:', error instanceof Error ? error.message : 'Unknown')
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')

        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Export failed',
                details: error instanceof Error ? error.stack : String(error)
            },
            { status: 500 }
        )
    }
}

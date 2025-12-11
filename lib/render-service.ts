import JSZip from "jszip"
import { Project, CaptionSettings } from "@/types"
import { SOUND_EFFECTS } from "@/lib/constants"

export interface RenderOptions {
    project: Project
    captionSettings: CaptionSettings
    width: number
    height: number
    outputWidth?: number
    outputHeight?: number
    backgroundVideoUrl?: string
    userId: string
    onProgress: (progress: number, details: string, phase: string) => void
    onComplete: (downloadUrl: string, jobId: string) => void
    onError: (error: any) => void
}

const base64ToBlob = (base64: string, type: string) => {
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    return new Blob([byteArray], { type })
}

export const renderVideo = async ({
    project,
    captionSettings,
    width,
    height,
    outputWidth,
    outputHeight,
    backgroundVideoUrl,
    userId,
    onProgress,
    onComplete,
    onError
}: RenderOptions) => {
    try {
        console.log("Starting render service...")
        let jobId: string | null = null

        // 1. Create Job immediately
        const videoTitle = project.title || (project.id ? `project-${project.id}` : 'untitled-video')
        const createRes = await fetch('/api/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userId,
                originalName: `${videoTitle}.mp4`,
                status: 'GENERATING'
            })
        })

        if (createRes.ok) {
            const data = await createRes.json()
            jobId = data.jobId
            console.log("Job created:", jobId)
        }

        // Calculate Duration
        let totalDuration = 0
        // We need to re-calculate duration since we don't have access to the existing Timeline state
        // OR we can pass it. But calculating it is safer to be self-contained.
        // Simplified duration calculation from buildTimeline:
        for (const sentence of project.sentences) {
            let duration = 0
            if (sentence.audioContent) {
                // We'd have to decode audio to get precise duration which is slow. 
                // However, the timeline *should* have been saved to project or we can estimate.
                // For now, let's assume strict calculation isn't possible without reloading audio.
                // FIX: Let's assume the project.sentences are enough? No, they don't have duration.
                // We will ESTIMATE based on word count which is poor.
                // BETTER: Pass `totalDuration` or `timeline` to this service?
                // The `project` object in the types I defined *doesn't* have duration.
                // BUT `page.tsx` calculates it.
                // Let's rely on a passed `duration` or calculate it here.
                // To be robust, let's re-calculate it as best we can.
                // Since this runs in client, we CAN use Audio to get duration.
                if (sentence.audioContent) {
                    const blob = base64ToBlob(sentence.audioContent, 'audio/mp3')
                    const url = URL.createObjectURL(blob)
                    const audio = new Audio(url)
                    await new Promise(r => {
                        audio.addEventListener('loadedmetadata', r)
                        setTimeout(r, 500)
                    })
                    duration = audio.duration || 1
                    URL.revokeObjectURL(url)
                } else {
                    const wordCount = sentence.words?.length || sentence.text.split(/\s+/).length
                    duration = Math.max(1, wordCount * 0.4)
                }
            } else {
                const wordCount = sentence.words?.length || sentence.text.split(/\s+/).length
                duration = Math.max(1, wordCount * 0.4)
            }
            totalDuration += duration + 0.5
        }

        const fps = 30
        const frameDuration = 1 / fps
        const totalFrames = Math.ceil(totalDuration * fps)

        onProgress(0, `Initializing...`, 'preloading')

        const zip = new JSZip()

        // Preload images and cache video frames
        const imageCache = new Map<string, HTMLImageElement | ImageBitmap[]>()
        const uniqueMediaUrls = new Set<string>()

        project.sentences.forEach((s) => {
            s.words?.forEach((w) => {
                if (w.mediaUrl) {
                    uniqueMediaUrls.add(w.mediaUrl)
                }
            })
        })

        let loadedCount = 0
        const totalAssets = uniqueMediaUrls.size

        await Promise.all(Array.from(uniqueMediaUrls).map(async (url) => {
            try {
                const isExternal = url.startsWith('http://') || url.startsWith('https://')
                const proxiedUrl = isExternal ? `/api/proxy?url=${encodeURIComponent(url)}` : url

                let type = 'image'
                for (const s of project.sentences) {
                    const w = s.words?.find(w => w.mediaUrl === url)
                    if (w?.mediaType === 'video') {
                        type = 'video'
                        break
                    }
                    if (url.match(/\.(mp4|webm|ogg|mov)$/i)) {
                        type = 'video'
                        break
                    }
                }

                if (type === 'video') {
                    const response = await fetch(proxiedUrl)
                    const blob = await response.blob()
                    const objectUrl = URL.createObjectURL(blob)

                    const video = document.createElement('video')
                    video.muted = true
                    video.preload = "auto"
                    video.src = objectUrl

                    await new Promise((resolve, reject) => {
                        video.onloadedmetadata = resolve
                        video.onerror = reject
                    })

                    const frames: ImageBitmap[] = []
                    // Only extract what's needed for loop? Or specific duration?
                    // The loop logic in page.tsx extracted WHOLE video.
                    const vidDuration = video.duration || 1
                    const vidTotalFrames = Math.ceil(vidDuration * fps)

                    // Optimization: Cap at 5 seconds for memes to save memory?
                    // Start with full extraction
                    const tempCanvas = document.createElement('canvas')
                    tempCanvas.width = video.videoWidth
                    tempCanvas.height = video.videoHeight
                    const tempCtx = tempCanvas.getContext('2d')

                    if (document.body) {
                        video.style.position = 'fixed'
                        video.style.opacity = '0'
                        video.style.pointerEvents = 'none'
                        document.body.appendChild(video)
                    }

                    if (tempCtx) {
                        for (let i = 0; i < vidTotalFrames; i++) {
                            const time = i / fps
                            video.currentTime = time
                            await new Promise<void>(resolve => {
                                const onSeeked = () => {
                                    video.removeEventListener('seeked', onSeeked)
                                    setTimeout(resolve, 50)
                                }
                                if (i === 0 && video.currentTime === 0 && video.readyState >= 2) {
                                    resolve()
                                } else {
                                    video.addEventListener('seeked', onSeeked)
                                }
                            })
                            tempCtx.drawImage(video, 0, 0)
                            const bitmap = await createImageBitmap(tempCanvas)
                            frames.push(bitmap)
                        }
                    }

                    if (document.body) {
                        document.body.removeChild(video)
                    }
                    URL.revokeObjectURL(objectUrl)
                    imageCache.set(url, frames)

                } else {
                    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                        const image = new Image()
                        image.crossOrigin = "anonymous"
                        image.onload = () => resolve(image)
                        image.onerror = (e) => reject(e)
                        image.src = proxiedUrl
                    })
                    imageCache.set(url, img)
                }

                loadedCount++
                onProgress(10 + (loadedCount / totalAssets) * 10, `Loaded asset ${loadedCount}/${totalAssets}`, 'preloading')

            } catch (e) {
                console.warn(`Failed to preload media ${url}:`, e)
            }
        }))

        // Background Video
        if (backgroundVideoUrl) {
            try {
                const response = await fetch(backgroundVideoUrl)
                const videoBlob = await response.blob()
                zip.file("background.mp4", videoBlob)
            } catch (e) {
                console.error("Failed to fetch background video", e)
            }
        }

        // Layout Pre-calculation
        const layoutCache = new Map<string, { lines: { words: any[], width: number }[], totalHeight: number }>()
        const measureCanvas = document.createElement('canvas')
        measureCanvas.width = width
        measureCanvas.height = height
        const measureCtx = measureCanvas.getContext('2d')!

        project.sentences.forEach(sentence => {
            if (!sentence.words) return

            const weight = captionSettings.fontWeight === 'extra-bold' ? '900' : captionSettings.fontWeight
            const style = captionSettings.isItalic ? 'italic' : 'normal'
            measureCtx.font = `${style} ${weight} ${captionSettings.fontSize}px ${captionSettings.fontFamily}`

            const maxWidth = measureCanvas.width * 0.7
            const lines: { words: any[], width: number }[] = []
            let currentLineWords: any[] = []
            let currentLineWidth = 0

            sentence.words.forEach((word) => {
                let text = word.displayText
                if (captionSettings.isUppercase) text = text.toUpperCase()
                const wordWidth = measureCtx.measureText(text + " ").width

                if (currentLineWidth + wordWidth < maxWidth) {
                    currentLineWords.push(word)
                    currentLineWidth += wordWidth
                } else {
                    lines.push({ words: currentLineWords, width: currentLineWidth - measureCtx.measureText(" ").width })
                    currentLineWords = [word]
                    currentLineWidth = wordWidth
                }
            })
            if (currentLineWords.length > 0) {
                lines.push({ words: currentLineWords, width: currentLineWidth - measureCtx.measureText(" ").width })
            }

            const lineHeight = captionSettings.fontSize * 1.3
            const totalHeight = lines.length * lineHeight
            layoutCache.set(sentence.id, { lines, totalHeight })
        })

        // GENERATION LOOP
        const CONCURRENCY = 4
        // Load watermark
        const watermarkImg = new Image()
        watermarkImg.src = '/watermark.jpg'
        await new Promise((resolve) => {
            watermarkImg.onload = resolve
            watermarkImg.onerror = resolve
        })

        // Helper to reconstruct timeline for drawing
        // We need to know which sentence/word is active at a given time
        // We previously calculated 'totalDuration' by iterating sentences.
        // We need that same iteration map to know precise start times.
        const timeline: { sentence: any, startTime: number, duration: number }[] = []
        let currentOffset = 0
        for (const sentence of project.sentences) {
            let duration = 0
            if (sentence.audioContent) {
                const blob = base64ToBlob(sentence.audioContent, 'audio/mp3')
                const url = URL.createObjectURL(blob)
                const audio = new Audio(url)
                await new Promise(r => {
                    audio.addEventListener('loadedmetadata', r)
                    setTimeout(r, 2000) // Increase timeout to ensure metadata loads
                })
                duration = audio.duration || 1
            } else {
                const wordCount = sentence.words?.length || sentence.text.split(/\s+/).length
                duration = Math.max(1, wordCount * 0.4)
            }
            timeline.push({ sentence, startTime: currentOffset, duration })
            currentOffset += duration + 0.5
        }


        onProgress(20, 'Generating frames...', 'generating')

        for (let i = 0; i < totalFrames; i += CONCURRENCY) {
            const batchPromises: Promise<void>[] = []
            for (let j = 0; j < CONCURRENCY && i + j < totalFrames; j++) {
                const task = (async () => {
                    const frameIdx = i + j
                    const exportTime = frameIdx * frameDuration

                    const canvas = document.createElement('canvas')
                    canvas.width = width
                    canvas.height = height
                    const ctx = canvas.getContext('2d', { alpha: true })
                    if (!ctx) return

                    // Check which sentence is active
                    const activeItem = timeline.find(t => exportTime >= t.startTime && exportTime < t.startTime + t.duration)

                    // Draw Watermark
                    if (watermarkImg.complete && watermarkImg.width > 0) {
                        // As per page.tsx
                        // ctx.globalAlpha = 0.5; ctx.drawImage...
                    }

                    // --- DRAWING LOGIC ---
                    // "Subscribe" banner
                    const bannerHeight = canvas.height * 0.05
                    ctx.fillStyle = '#ff0000'
                    ctx.fillRect(0, 0, canvas.width, bannerHeight)
                    ctx.fillStyle = '#ffffff'
                    ctx.font = `bold ${Math.round(bannerHeight * 0.6)}px Arial`
                    ctx.textAlign = 'center'
                    ctx.textBaseline = 'middle'
                    ctx.fillText("Subscribe for more", canvas.width / 2, bannerHeight / 2)


                    if (activeItem) {
                        const { sentence, startTime, duration } = activeItem
                        const timeInSentence = exportTime - startTime

                        // Render Overlay Media
                        // Render Overlay Media
                        if (sentence.words) {
                            const wordCount = sentence.words.length
                            const wDuration = duration / wordCount

                            // Look backwards for the most recent overlay within the last 3 seconds
                            let activeOverlayWord = null
                            let activeOverlayStartTime = 0

                            for (let i = Math.floor(timeInSentence / wDuration); i >= 0; i--) {
                                const word = sentence.words[i]
                                const wordStart = i * wDuration
                                if (timeInSentence - wordStart > 3.0) break // Stop looking if > 3s ago

                                if (word.mediaUrl) {
                                    activeOverlayWord = word
                                    activeOverlayStartTime = wordStart
                                    break // Found the most recent one
                                }
                            }

                            if (activeOverlayWord && activeOverlayWord.mediaUrl) {
                                const asset = imageCache.get(activeOverlayWord.mediaUrl)
                                if (asset) {
                                    // Dimension logic matching preview (approx 400px on desktop)
                                    // Using relative sizing for video resolution independence
                                    const size = Math.min(canvas.width * 0.6, canvas.height * 0.4)
                                    const x = (canvas.width - size) / 2

                                    let y = 0
                                    if (captionSettings.swapPosition) {
                                        y = (canvas.height * 0.75) - (size / 2)
                                    } else {
                                        y = (canvas.height - size) / 2 // Center vertically if not swapped, or top?
                                        // Preview uses (canvas.height - size) / 2 for center.
                                        // But if captions are at bottom, overlay should be center-ish or top?
                                        // Preview logic: if !swapPosition, captions are at bottom (default), overlay is centered?
                                        // Let's stick to the swapped logic:
                                        // If swap (captions top), overlay bottom: 75%
                                        // If normal (captions bottom), overlay center?? Or top area?
                                        // The preview code uses (height - size) / 2 for !swapPosition. Let's match that.
                                        y = (canvas.height * 0.25) - (size / 2) // Move it up a bit if captions are at bottom
                                        if (!captionSettings.swapPosition) {
                                            y = (canvas.height * 0.35) - (size / 2) // Roughly upper middle
                                        }
                                    }

                                    if (asset instanceof HTMLImageElement) {
                                        // Draw Image
                                        // Apply simple animation (pop in)
                                        const timeActive = timeInSentence - activeOverlayStartTime
                                        let scale = 1
                                        if (timeActive < 0.15) {
                                            scale = 0.8 + (timeActive / 0.15) * 0.2
                                        }

                                        ctx.save()
                                        ctx.translate(x + size / 2, y + size / 2)
                                        ctx.scale(scale, scale)
                                        ctx.drawImage(asset, -size / 2, -size / 2, size, size)
                                        ctx.restore()
                                    } else if (Array.isArray(asset)) {
                                        // Draw Video Frame
                                        const timeActive = timeInSentence - activeOverlayStartTime
                                        const vidFps = 30
                                        const vidFrameIdx = Math.floor(timeActive * vidFps) % asset.length
                                        const bitmap = asset[vidFrameIdx]

                                        if (bitmap) {
                                            ctx.drawImage(bitmap, x, y, size, size)
                                        }
                                    }
                                }
                            }
                        }

                        // Render Text
                        const layout = layoutCache.get(sentence.id)
                        if (layout) {
                            const { lines, totalHeight } = layout
                            let yText = 0

                            if (captionSettings.swapPosition) {
                                // Top
                                yText = (canvas.height * 0.45 - totalHeight) / 2
                            } else {
                                // Bottom
                                yText = canvas.height * 0.55 + (canvas.height * 0.45 - totalHeight) / 2
                            }

                            // Padding
                            yText += captionSettings.paddingTop || 0

                            const weight = captionSettings.fontWeight === 'extra-bold' ? '900' : captionSettings.fontWeight
                            const style = captionSettings.isItalic ? 'italic' : 'normal'
                            ctx.font = `${style} ${weight} ${captionSettings.fontSize}px ${captionSettings.fontFamily}`
                            ctx.textAlign = 'center'
                            ctx.textBaseline = 'top'

                            lines.forEach(line => {
                                let x = (canvas.width - line.width) / 2
                                line.words.forEach(word => {
                                    let text = word.displayText
                                    if (captionSettings.isUppercase) text = text.toUpperCase()

                                    // Highlight current word
                                    const wordCount = sentence.words?.length || 1
                                    const wDuration = duration / wordCount
                                    const currentWordIndex = Math.floor(timeInSentence / wDuration)
                                    // Check if this word is the current one
                                    const isCurrent = sentence.words && sentence.words[currentWordIndex]?.id === word.id

                                    if (isCurrent) {
                                        ctx.fillStyle = '#ffff00' // Highlight color (Yellow)
                                        // Scale animation
                                        // ctx.save(); ctx.scale... (Too complex for this snippet, skipping detailed text anim)
                                    } else {
                                        ctx.fillStyle = captionSettings.textColor
                                    }

                                    // Shadow
                                    if (captionSettings.hasShadow) {
                                        ctx.shadowColor = captionSettings.shadowColor
                                        ctx.shadowBlur = 0
                                        ctx.shadowOffsetX = captionSettings.shadowSize
                                        ctx.shadowOffsetY = captionSettings.shadowSize
                                    }

                                    // Draw text
                                    ctx.textAlign = 'left'
                                    ctx.fillText(text, x, yText)

                                    x += ctx.measureText(text + " ").width

                                    // Reset shadow
                                    ctx.shadowColor = 'transparent'
                                })
                                yText += captionSettings.fontSize * 1.3
                            })
                        }
                    }

                    // Convert to Blob
                    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
                    if (blob) {
                        const buffer = await blob.arrayBuffer()
                        zip.file(`frame${String(frameIdx).padStart(5, '0')}.png`, buffer)
                    }

                })()
                batchPromises.push(task)
            }
            await Promise.all(batchPromises)
            onProgress(20 + (i / totalFrames) * 60, `Frame ${i}/${totalFrames}`, 'generating')
        }

        // Add Audio
        onProgress(80, 'Processing audio...', 'zipping')
        const audioTracks: { filename: string, startTime: number, volume?: number, loop?: boolean }[] = []

        let exportOffset = 0
        for (const item of timeline) {
            const { sentence, startTime, duration } = item

            if (sentence.audioContent) {
                const blob = base64ToBlob(sentence.audioContent, 'audio/mp3')
                const filename = `tts_${startTime.toFixed(3)}.mp3`
                zip.file(filename, blob)
                audioTracks.push({ filename, startTime: startTime })
            }

            // SFX Logic
            if (sentence.words) {
                const wordDuration = duration / sentence.words.length
                for (let j = 0; j < sentence.words.length; j++) {
                    const word = sentence.words[j]
                    if (word.soundEffect && word.soundEffect !== 'none') {
                        const effect = SOUND_EFFECTS.find(e => e.id === word.soundEffect)
                        if (effect && effect.src) {
                            try {
                                const response = await fetch(effect.src)
                                const blob = await response.blob()
                                const sfxStartTime = startTime + (j * wordDuration)
                                const filename = `sfx_${sfxStartTime.toFixed(3)}.mp3`
                                zip.file(filename, blob)
                                audioTracks.push({ filename, startTime: sfxStartTime })
                            } catch (e) {
                                console.warn("Failed to fetch SFX:", effect.name)
                            }
                        }
                    }
                }
            }
        }

        // Add Background Music (Piano)
        try {
            const bgMusicRes = await fetch('/music/background-piano.mp3')
            if (bgMusicRes.ok) {
                const bgBlob = await bgMusicRes.blob()
                zip.file("bg_music.mp3", bgBlob)
                audioTracks.push({
                    filename: "bg_music.mp3",
                    startTime: 0,
                    volume: 0.1, // Low volume ("kısık sesli")
                    loop: true
                })
            }
        } catch (e) {
            console.warn("Failed to add background music:", e)
        }

        // Add JSON
        zip.file("project.json", JSON.stringify(project, null, 2))

        // Create metadata
        const metadata = {
            fps: fps,
            duration: totalDuration, // Use calculated duration
            width: width,
            height: height,
            outputWidth: outputWidth || width,
            outputHeight: outputHeight || height,
            mode: 'overlay',
            backgroundVideo: project.backgroundVideo,
            backgroundThumbnail: project.backgroundThumbnail,
            projectId: project.id,
            audioTracks: audioTracks
        }
        zip.file("metadata.json", JSON.stringify(metadata, null, 2))

        // Generate Zip
        onProgress(90, 'Compressing archive...', 'zipping')
        const content = await zip.generateAsync({ type: "blob" })

        // Upload
        onProgress(95, 'Uploading...', 'uploading')
        const formData = new FormData()
        // Use the jobId we created earlier or create new
        const filename = videoTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase() + ".zip"

        formData.append('file', content, filename)
        formData.append('originalName', `${videoTitle}.mp4`)

        if (jobId) {
            formData.append('jobId', jobId)
        }

        const uploadRes = await fetch('/api/jobs', {
            method: 'POST',
            body: formData
        })

        if (!uploadRes.ok) {
            throw new Error("Upload failed")
        }

        const uploadData = await uploadRes.json()
        onProgress(100, 'Done!', 'uploading')
        onComplete(uploadData.url || '', jobId || (uploadData.jobId))


    } catch (error) {
        console.error("Render failed:", error)
        // Update job status to failed if possible
        /* 
        if (jobId) {
             fetch(`/api/jobs/${jobId}`, {
                 method: 'PUT',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ status: 'FAILED', error: String(error) })
             })
        }
        */
        onError(error)
    }
}

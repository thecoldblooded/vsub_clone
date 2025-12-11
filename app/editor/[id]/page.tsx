"use client"

import { Navbar } from "@/components/Navbar"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Play, Pause, SkipBack, SkipForward, Download, Share2, ChevronUp, ChevronDown, AlertCircle, Trash2, Plus, Bold, Italic, Type, Volume2, Image as ImageIcon, Settings, Sparkles, Loader2 } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import React, { useState, useRef, useEffect, useCallback } from "react"

import { useRouter } from "next/navigation"
import { useToast } from "@/components/providers/toast-provider"
import { useRender } from "@/components/providers/render-provider"
import { Project, Sentence, Word, CaptionSettings, TimelineItem } from "@/types"
import { SOUND_EFFECTS, FONT_OPTIONS } from "@/lib/constants"
// FONT_OPTIONS and SOUND_EFFECTS were locally defined too. Removing local definitions.

// Removed local interfaces (Word, Sentence, Project, CaptionSettings, TimelineItem) as they are now imported.


const VOICE_MODELS = [
    // Standard Voices
    { name: "Journey (US Male)", id: "en-US-Journey-D", model: "standard" },
    { name: "Journey (US Female)", id: "en-US-Journey-F", model: "standard" },
    { name: "Casual (US Male)", id: "en-US-Casual-K", model: "standard" },
    { name: "Studio (US Male)", id: "en-US-Studio-M", model: "standard" },
    { name: "Studio (US Female)", id: "en-US-Studio-O", model: "standard" },
    // Gemini Flash Voices
    { name: "Kore (Flash - Female)", id: "Kore", model: "gemini-2.5-flash-tts" },
    { name: "Puck (Flash - Male)", id: "Puck", model: "gemini-2.5-flash-tts" },
    { name: "Charon (Flash - Male)", id: "Charon", model: "gemini-2.5-flash-tts" },
    { name: "Fenrir (Flash - Male)", id: "Fenrir", model: "gemini-2.5-flash-tts" },
    { name: "Aoede (Flash - Female)", id: "Aoede", model: "gemini-2.5-flash-tts" },
]

export default function EditorPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = React.use(params)
    const [project, setProject] = useState<Project | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0)
    const [activeTab, setActiveTab] = useState<'settings' | 'content'>('settings')
    const [scriptText, setScriptText] = useState("")
    const [totalDuration, setTotalDuration] = useState(0)
    const [timeline, setTimeline] = useState<TimelineItem[]>([])

    // Removed local export states as they are now managed by RenderContext
    // const [isExporting, setIsExporting] = useState(false)
    // const [exportProgress, setExportProgress] = useState(0)
    // const [exportDetails, setExportDetails] = useState({ frame: 0, totalFrames: 0, time: 0, totalTime: 0 })
    // const [exportPhase, setExportPhase] = useState<'preloading' | 'generating' | 'zipping' | 'uploading'>('preloading')

    // Setup Context
    const { startRender, isRendering: isContextRendering, progress: contextProgress, status: contextStatus, phase: contextPhase } = useRender()

    // Mapping context state to local variables for compatibility with existing UI (if any modal uses them)
    // If we want the modal to show, we can use these.
    const isExporting = isContextRendering
    const exportProgress = contextProgress
    const exportPhase = contextPhase


    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved')
    const [isAiProcessing, setIsAiProcessing] = useState(false)
    const [generatingWordId, setGeneratingWordId] = useState<string | null>(null)
    const router = useRouter()
    const { error: showError, success, info } = useToast()

    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const soundEffectRef = useRef<HTMLAudioElement | null>(null)
    const bgMusicRef = useRef<HTMLAudioElement | null>(null)
    const requestRef = useRef<number>(0)
    const lastTimeRef = useRef<number>(0)

    // Refs for loop state to avoid stale closures
    const currentTimeRef = useRef(0)
    const isPlayingRef = useRef(false)
    const timelineRef = useRef<TimelineItem[]>([])
    const totalDurationRef = useRef(0)
    const currentSentenceIndexRef = useRef(-1) // Start at -1 to force update on first play
    const audioGenerationTimeouts = useRef<{ [key: string]: NodeJS.Timeout }>({})



    // Captions State
    const [isCaptionsOpen, setIsCaptionsOpen] = useState(true)
    const [captionSettings, setCaptionSettings] = useState<CaptionSettings>({
        fontFamily: 'Arial',
        fontSize: 96,
        isUppercase: false,
        fontWeight: 'bold',
        isItalic: false,
        textColor: '#ffffff',
        hasShadow: true,
        shadowColor: '#000000',
        shadowSize: 4,
        hasBackground: false,
        paddingTop: 80,
        swapPosition: false
    })

    // Load project from API
    useEffect(() => {
        const loadProject = async () => {
            try {
                const res = await fetch(`/api/projects/${resolvedParams.id}`)
                if (res.ok) {
                    const data = await res.json()

                    // Parse words if missing (backward compatibility)
                    data.sentences = data.sentences.map((s: Sentence) => {
                        if (!s.words) {
                            s.words = s.text.split(' ').map((w, i) => ({
                                id: `${s.id}-word-${i}`,
                                text: w,
                                displayText: w
                            }))
                        }
                        return s
                    })

                    if (data.captionSettings) {
                        setCaptionSettings(data.captionSettings)
                    }

                    setProject(data)
                } else {
                    console.error("Failed to load project")
                    // Fallback to localStorage if API fails (optional, maybe not needed if we fully migrate)
                }
            } catch (error) {
                console.error("Error loading project:", error)
            }
        }
        loadProject()
    }, [resolvedParams.id])

    // Initialize Background Music
    useEffect(() => {
        const audio = new Audio('/music/background-piano.mp3')
        audio.loop = true
        audio.volume = 0.1 // Low volume
        bgMusicRef.current = audio
        return () => {
            audio.pause()
            bgMusicRef.current = null
        }
    }, [])

    // Auto-save Project
    useEffect(() => {
        if (!project) return

        setSaveStatus('saving')

        const saveProject = async () => {
            try {
                const projectToSave = {
                    ...project,
                    captionSettings
                }

                await fetch(`/api/projects/${project.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(projectToSave)
                })
                console.log("Auto-saved project")
                setSaveStatus('saved')
            } catch (error) {
                console.error("Failed to auto-save:", error)
                setSaveStatus('error')
            }
        }

        // Debounce save
        const timeoutId = setTimeout(saveProject, 2000)
        return () => clearTimeout(timeoutId)
    }, [project, captionSettings])

    // Build Timeline
    useEffect(() => {
        if (!project) return

        const buildTimeline = async () => {
            const newTimeline: TimelineItem[] = []
            let currentOffset = 0

            for (const sentence of project.sentences) {
                let duration = 0
                let url = ''

                if (sentence.audioContent) {
                    const blob = base64ToBlob(sentence.audioContent, 'audio/mp3')
                    url = URL.createObjectURL(blob)

                    // Get duration
                    const audio = new Audio(url)
                    await new Promise(resolve => {
                        audio.addEventListener('loadedmetadata', () => {
                            resolve(null)
                        })
                        setTimeout(() => resolve(null), 1000)
                    })

                    duration = audio.duration || 1
                } else {
                    // Estimate duration for new/edited sentences without audio
                    // approx 0.4s per word
                    const wordCount = sentence.words?.length || sentence.text.split(/\s+/).length
                    duration = Math.max(1, wordCount * 0.4)
                }

                newTimeline.push({
                    sentenceId: sentence.id,
                    startTime: currentOffset,
                    duration: duration,
                    audioUrl: url
                })
                currentOffset += duration + 0.5 // Add 0.5s pause between sentences
            }
            setTimeline(newTimeline)
            timelineRef.current = newTimeline
            setTotalDuration(currentOffset)
            totalDurationRef.current = currentOffset
        }

        buildTimeline()

        return () => {
            timeline.forEach(item => URL.revokeObjectURL(item.audioUrl))
        }
    }, [project])

    const base64ToBlob = (base64: string, type: string) => {
        const byteCharacters = atob(base64)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        return new Blob([byteArray], { type })
    }

    // Sync Playback Logic
    const syncPlayback = useCallback((time: number, forceSeek: boolean = false) => {
        const timeline = timelineRef.current

        // Immediately pause audio if not playing
        if (!isPlayingRef.current) {
            if (audioRef.current && !audioRef.current.paused) {
                audioRef.current.pause()
            }
            if (videoRef.current && !videoRef.current.paused) {
                videoRef.current.pause()
            }
            return
        }

        // Find current sentence
        const index = timeline.findIndex(t => time >= t.startTime && time < t.startTime + t.duration)
        const item = timeline[index]

        if (item) {
            if (index !== currentSentenceIndexRef.current || forceSeek) {
                currentSentenceIndexRef.current = index
                setCurrentSentenceIndex(index)

                if (audioRef.current) {
                    const srcUrl = new URL(item.audioUrl, window.location.href).href
                    const currentSrc = audioRef.current.src

                    if (currentSrc !== srcUrl) {
                        audioRef.current.src = item.audioUrl
                    }

                    const seekTime = time - item.startTime
                    if (Math.abs(audioRef.current.currentTime - seekTime) > 0.1 || forceSeek) {
                        audioRef.current.currentTime = seekTime
                    }

                    if (isPlayingRef.current && audioRef.current.paused) {
                        audioRef.current.play().catch(() => { })
                    }
                }
            } else {
                // Sync Check: Only correct if drift is significant (> 0.5s) to prevent stutter
                if (audioRef.current && !audioRef.current.paused) {
                    const expectedTime = time - item.startTime
                    if (Math.abs(audioRef.current.currentTime - expectedTime) > 0.5) {
                        audioRef.current.currentTime = expectedTime
                    }
                } else if (isPlayingRef.current && audioRef.current) {
                    audioRef.current.play().catch(() => { })
                }
            }

            // Sound effects logic - Per Word (runs for every frame, not just sentence changes)
            const sentence = project?.sentences[index]
            if (sentence && sentence.words) {
                const sentenceDuration = item.duration
                const wordCount = sentence.words.length
                const wordDuration = sentenceDuration / wordCount

                // Calculate which word we're currently on
                const timeInSentence = time - item.startTime
                const currentWordIndex = Math.floor(timeInSentence / wordDuration)
                const currentWord = sentence.words[currentWordIndex]

                // Play sound effect when word starts (check if we just entered this word)
                const prevWordIndex = Math.floor((time - 0.05 - item.startTime) / wordDuration)
                if (currentWordIndex !== prevWordIndex && currentWord && currentWord.soundEffect && currentWord.soundEffect !== 'none') {
                    console.log("🔊 Playing sound effect:", currentWord.soundEffect, "for word:", currentWord.text)
                    const effect = SOUND_EFFECTS.find(e => e.id === currentWord.soundEffect)
                    if (effect && effect.src && soundEffectRef.current) {
                        console.log("🔊 Sound effect URL:", effect.src)
                        // Only change src if it's different to avoid AbortError
                        if (soundEffectRef.current.src !== effect.src) {
                            soundEffectRef.current.src = effect.src
                        }
                        // Reset and play
                        soundEffectRef.current.currentTime = 0
                        soundEffectRef.current.play().catch((err) => {
                            console.error("🔊 Sound effect play failed:", err)
                        })
                    } else {
                        console.log("🔊 Sound effect not found or no URL:", effect)
                    }
                }
            }
        }

        // Sync Video (Looping)
        if (videoRef.current) {
            const vidDuration = videoRef.current.duration
            const isDurationValid = vidDuration && Number.isFinite(vidDuration) && vidDuration > 0

            if (forceSeek && isDurationValid) {
                const vidTime = time % vidDuration
                console.log("Seeking video to:", vidTime, "Total time:", time, "Duration:", vidDuration)
                videoRef.current.currentTime = vidTime
            }

            if (isPlayingRef.current) {
                // Just ensure it's playing
                if (videoRef.current.paused) {
                    videoRef.current.play().catch(e => console.error("Video play error:", e))
                }
            } else {
                // Not playing
                if (!videoRef.current.paused) {
                    videoRef.current.pause()
                }
            }
        }

        // Sync Background Music
        if (bgMusicRef.current) {
            const bgDuration = bgMusicRef.current.duration
            if (bgDuration && Number.isFinite(bgDuration)) {
                if (forceSeek) {
                    bgMusicRef.current.currentTime = time % bgDuration
                }
                if (isPlayingRef.current) {
                    if (bgMusicRef.current.paused) bgMusicRef.current.play().catch(() => { })
                } else {
                    if (!bgMusicRef.current.paused) bgMusicRef.current.pause()
                }
            }
        }

    }, [project])

    // Animation Loop
    const animate = useCallback((time: number) => {
        if (!isPlayingRef.current) return

        const deltaTime = (time - lastTimeRef.current) / 1000
        lastTimeRef.current = time

        let newTime = currentTimeRef.current + deltaTime

        if (newTime >= totalDurationRef.current) {
            newTime = 0
            setIsPlaying(false)
            isPlayingRef.current = false
            if (videoRef.current) videoRef.current.pause()
            if (audioRef.current) audioRef.current.pause()
        }

        currentTimeRef.current = newTime
        setCurrentTime(newTime)
        syncPlayback(newTime)

        requestRef.current = requestAnimationFrame(animate)
    }, [syncPlayback])

    // Start/Stop animation loop when isPlaying changes
    useEffect(() => {
        if (isPlaying) {
            isPlayingRef.current = true
            lastTimeRef.current = performance.now()
            requestRef.current = requestAnimationFrame(animate)
            if (bgMusicRef.current) {
                bgMusicRef.current.play().catch(e => console.warn("BG play failed", e))
            }
        } else {
            isPlayingRef.current = false
            // Immediately pause audio and video when stopping
            if (audioRef.current && !audioRef.current.paused) {
                audioRef.current.pause()
            }
            if (videoRef.current && !videoRef.current.paused) {
                videoRef.current.pause()
            }
            if (bgMusicRef.current && !bgMusicRef.current.paused) {
                bgMusicRef.current.pause()
            }
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current)
            }
        }

        return () => {
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current)
            }
            // Cleanup BG music on unmount/re-render handled by its own effect, but safe to pause here
            if (bgMusicRef.current) bgMusicRef.current.pause()
        }
    }, [isPlaying, animate])

    const togglePlay = () => {
        setIsPlaying(!isPlaying)
    }

    const handleSliderChange = (vals: number[]) => {
        const newTime = vals[0]
        currentTimeRef.current = newTime
        setCurrentTime(newTime)
        syncPlayback(newTime, true) // Force seek
    }

    const handleSkipForward = () => {
        const newTime = Math.min(totalDurationRef.current, currentTimeRef.current + 5)
        currentTimeRef.current = newTime
        setCurrentTime(newTime)
        syncPlayback(newTime, true)
    }

    const handleSkipBack = () => {
        const newTime = Math.max(0, currentTimeRef.current - 5)
        currentTimeRef.current = newTime
        setCurrentTime(newTime)
        syncPlayback(newTime, true)
    }


    const handleDownload = async (format: 'mp4' | 'webm' = 'mp4', includeBackground: boolean = true) => {
        if (!project) return
        if (project.sentences.some(s => s.isGenerating)) {
            showError("Please wait for audio generation to finish before exporting.")
            return
        }

        // Detect aspect ratio based on preview or defaults
        let baseWidth = 1080
        let baseHeight = 1920
        if (videoRef.current && videoRef.current.videoWidth) {
            baseWidth = videoRef.current.videoWidth
            baseHeight = videoRef.current.videoHeight
        }

        // FORCE 4K UPSCALE (Vertical 9:16)
        // If the base is horizontal (e.g. 1920x1080), we might want 4K horizontal (3840x2160).
        // Let's deduce target 4K based on orientation.
        const isLandscape = baseWidth > baseHeight
        const targetWidth = isLandscape ? 3840 : 2160
        const targetHeight = isLandscape ? 2160 : 3840

        const scaleFactor = targetWidth / baseWidth

        // Scale settings
        const scaledSettings: CaptionSettings = {
            ...captionSettings,
            fontSize: Math.round(captionSettings.fontSize * scaleFactor),
            shadowSize: Math.round(captionSettings.shadowSize * scaleFactor),
            paddingTop: captionSettings.paddingTop ? Math.round(captionSettings.paddingTop * scaleFactor) : 0
        }

        console.log(`Rendering 4K Upscale: ${targetWidth}x${targetHeight} (Scale: ${scaleFactor})`)

        startRender(project, scaledSettings, targetWidth, targetHeight)
    }

    const generateAudioForSentence = async (text: string, voiceId: string, speed: number, pitch: number) => {
        try {
            const voice = VOICE_MODELS.find(v => v.id === voiceId)
            const model = voice?.model || 'standard'

            const response = await fetch('/api/vertex/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text,
                    voiceId,
                    speed,
                    pitch,
                    model
                })
            })

            if (!response.ok) throw new Error("TTS generation failed")

            const data = await response.json()
            return data.audioContent // Base64
        } catch (error) {
            console.error("Audio generation error:", error)
            return null
        }
    }

    const updateWord = (sentenceId: string, wordId: string, updates: Partial<Word>) => {
        if (!project) return
        setProject({
            ...project,
            sentences: project.sentences.map(s => {
                if (s.id === sentenceId && s.words) {
                    return {
                        ...s,
                        words: s.words.map(w => w.id === wordId ? { ...w, ...updates } : w)
                    }
                }
                return s
            })
        })
    }

    const updateSentence = (id: string, updates: Partial<Sentence>) => {
        if (!project) return

        setProject(prev => {
            if (!prev) return null
            const newSentence = { ...prev.sentences.find(s => s.id === id)!, ...updates }

            return {
                ...prev,
                sentences: prev.sentences.map(s => s.id === id ? newSentence : s)
            }
        })

        // Debounced audio regeneration
        if (updates.text || updates.voice || updates.speed || updates.pitch) {
            if (audioGenerationTimeouts.current[id]) {
                clearTimeout(audioGenerationTimeouts.current[id])
            }

            audioGenerationTimeouts.current[id] = setTimeout(async () => {
                console.log("Auto-regenerating audio for sentence:", id)
                setProject(current => {
                    if (!current) return null
                    return {
                        ...current,
                        sentences: current.sentences.map(s =>
                            s.id === id ? { ...s, isGenerating: true } : s
                        )
                    }
                })

                try {
                    const s = project.sentences.find(s => s.id === id)
                    if (!s) return
                    // Use latest values from updates or current s
                    const text = updates.text ?? s.text
                    const voice = updates.voice ?? s.voice
                    const speed = updates.speed ?? s.speed ?? 1
                    const pitch = updates.pitch ?? s.pitch ?? 0

                    const audio = await generateAudioForSentence(text, voice, speed, pitch)

                    setProject(current => {
                        if (!current) return null
                        return {
                            ...current,
                            sentences: current.sentences.map(s =>
                                s.id === id ? { ...s, audioContent: audio || s.audioContent, isGenerating: false } : s
                            )
                        }
                    })
                } catch (e) {
                    console.error("Audio gen failed", e)
                    setProject(current => {
                        if (!current) return null
                        return {
                            ...current,
                            sentences: current.sentences.map(s =>
                                s.id === id ? { ...s, isGenerating: false } : s
                            )
                        }
                    })
                }
            }, 1000)
        }
    }

    const addSentence = (index: number) => {
        if (!project) return

        const prevSentence = project.sentences[index]
        const inheritedVoice = prevSentence?.voice || "en-US-Journey-D"
        const inheritedSpeed = prevSentence?.speed || 1
        const inheritedPitch = prevSentence?.pitch || 0

        const newSentence: Sentence = {
            id: crypto.randomUUID(),
            text: "New sentence",
            voice: inheritedVoice,
            speed: inheritedSpeed,
            pitch: inheritedPitch,
            words: [{
                id: crypto.randomUUID(),
                text: "New",
                displayText: "New",
                isLineBreak: false
            }, {
                id: crypto.randomUUID(),
                text: "sentence",
                displayText: "sentence",
                isLineBreak: false
            }]
        }

        const newSentences = [...project.sentences]
        newSentences.splice(index + 1, 0, newSentence)

        setProject({ ...project, sentences: newSentences })
    }

    const handleRegenerateSentenceAudio = async (sentenceId: string) => {
        if (!project) return

        setProject(prev => {
            if (!prev) return null
            return {
                ...prev,
                sentences: prev.sentences.map(s => s.id === sentenceId ? { ...s, isGenerating: true } : s)
            }
        })

        const sentence = project.sentences.find(s => s.id === sentenceId)
        if (!sentence) return

        try {
            const audio = await generateAudioForSentence(sentence.text, sentence.voice, sentence.speed || 1, sentence.pitch || 0)
            if (audio) {
                setProject(prev => {
                    if (!prev) return null
                    return {
                        ...prev,
                        sentences: prev.sentences.map(s =>
                            s.id === sentenceId ? { ...s, audioContent: audio, isGenerating: false } : s
                        )
                    }
                })
            } else {
                setProject(prev => {
                    if (!prev) return null
                    return {
                        ...prev,
                        sentences: prev.sentences.map(s => s.id === sentenceId ? { ...s, isGenerating: false } : s)
                    }
                })
            }
        } catch (e) {
            setProject(prev => {
                if (!prev) return null
                return {
                    ...prev,
                    sentences: prev.sentences.map(s => s.id === sentenceId ? { ...s, isGenerating: false } : s)
                }
            })
        }
    }

    const handleGenerateWordOverlay = async (sentenceId: string, wordId: string, wordText: string) => {
        if (!project) return

        setGeneratingWordId(wordId)
        try {
            const res = await fetch('/api/ai-overlays', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sentences: [{ id: sentenceId, text: wordText }],
                    availableSounds: SOUND_EFFECTS.filter(s => s.id !== 'none'),
                    ignoreConstraints: true
                })
            })

            if (res.ok) {
                const data = await res.json()
                if (data.overlays && data.overlays.length > 0) {
                    const overlay = data.overlays[0]
                    updateWord(sentenceId, wordId, {
                        mediaUrl: overlay.mediaUrl,
                        mediaType: overlay.mediaType || 'image',
                        soundEffect: overlay.soundEffect
                    })
                    success(`Generated overlay for "${wordText}"!`)
                } else {
                    info(`No overlay found for "${wordText}"`)
                }
            } else {
                showError("Failed to generate overlay")
            }
        } catch (e) {
            console.error("Generate overlay error:", e)
            showError("An error occurred")
        } finally {
            setGeneratingWordId(null)
        }
    }

    const handleAiMagic = async () => {
        if (!project) return
        setIsAiProcessing(true)
        try {
            // Construct script        try {
            const sentencesPayload = project.sentences.map(s => ({
                id: s.id,
                text: s.text
            }))

            const res = await fetch('/api/ai-overlays', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sentences: sentencesPayload,
                    availableSounds: SOUND_EFFECTS
                })
            })

            const data = await res.json()

            if (res.ok) {
                if (data.overlays && data.overlays.length > 0) {
                    let updatedCount = 0
                    const newSentences = [...project.sentences]

                    // Helper to normalize text for matching
                    const normalize = (text: string) => text.toLowerCase()
                        .replace(/[’'"]/g, '') // Remove quotes
                        .replace(/[^\w\s]/g, '') // Remove other punctuation
                        .replace(/\s+/g, ' ') // Collapse whitespace
                        .trim()

                    data.overlays.forEach((overlay: any) => {
                        // Find matching sentence by ID
                        const sIdx = newSentences.findIndex(s => s.id === overlay.sentenceId)
                        if (sIdx === -1) return

                        const sentence = newSentences[sIdx]
                        if (!sentence.words || sentence.words.length === 0) return

                        const overlayPhrase = normalize(overlay.word)
                        const overlayWords = overlayPhrase.split(' ')

                        const sentenceWords = sentence.words.map(w => ({
                            ...w,
                            normalized: normalize(w.displayText)
                        }))

                        let matchIndex = -1

                        // Strategy 1: Exact Phrase Match sequence
                        for (let wIdx = 0; wIdx <= sentenceWords.length - overlayWords.length; wIdx++) {
                            let match = true
                            for (let k = 0; k < overlayWords.length; k++) {
                                if (sentenceWords[wIdx + k].normalized !== overlayWords[k]) {
                                    match = false
                                    break
                                }
                            }
                            if (match) {
                                matchIndex = wIdx
                                break
                            }
                        }

                        // Strategy 2: Fallback - Match Longest Substituted Word (if > 4 chars)
                        if (matchIndex === -1 && overlayWords.length > 1) {
                            // Find longest word in overlay
                            const longestWord = overlayWords.reduce((a: string, b: string) => a.length > b.length ? a : b, "")
                            if (longestWord.length >= 4) {
                                matchIndex = sentenceWords.findIndex(w => w.normalized === longestWord)
                            }
                        }

                        // Strategy 3: Single word simple match
                        if (matchIndex === -1) {
                            matchIndex = sentenceWords.findIndex(w => w.normalized === overlayPhrase)
                        }

                        // Strategy 4 (Universal Fallback): Apply to the first word if everything matched fails
                        // Logic: We MUST show the overlay for this sentence since the AI generated it.
                        if (matchIndex === -1) {
                            matchIndex = 0
                        }

                        // Apply overlay
                        if (matchIndex !== -1 && newSentences[sIdx].words) {
                            newSentences[sIdx].words![matchIndex] = {
                                ...newSentences[sIdx].words![matchIndex],
                                mediaUrl: overlay.mediaUrl,
                                mediaType: overlay.mediaType || 'image',
                                soundEffect: overlay.soundEffect || newSentences[sIdx].words![matchIndex].soundEffect
                            }
                            updatedCount++
                        }
                    })

                    setProject({ ...project, sentences: newSentences })
                    success(`Applied ${updatedCount} AI overlays!`)
                } else {
                    info("AI didn't find any good meme opportunities.")
                }
            } else {
                showError("AI Magic failed. Please try again.")
            }
        } catch (e) {
            console.error("AI Magic error:", e)
            showError("An error occurred.")
        } finally {
            setIsAiProcessing(false)
        }
    }

    const handleImportCustomScript = () => {
        if (!scriptText.trim() || !project) return

        const rawSentences = scriptText.match(/[^.!?]+([.!?]+|$)/g) || []

        const newSentences = rawSentences.map((text) => {
            const cleanText = text.trim()
            if (!cleanText) return null

            const words: Word[] = cleanText.split(/\s+/).map((w, wIdx) => ({
                id: crypto.randomUUID(),
                text: w,
                displayText: w,
                isLineBreak: false
            }))

            const sentence: Sentence = {
                id: crypto.randomUUID(),
                text: cleanText,
                voice: "en-US-Journey-D",
                words: words
            }
            return sentence
        }).filter((s): s is Sentence => s !== null)

        if (newSentences.length > 0) {
            setProject({
                ...project,
                sentences: newSentences
            })
            setScriptText("")
            success(`Imported ${newSentences.length} sentences!`)
        }
    }

    // Canvas Rendering Loop
    useEffect(() => {
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (!canvas || !ctx || !project) return

        const watermarkImg = new Image()
        watermarkImg.src = '/watermark.jpg'

        const render = () => {
            // Clear canvas with black background
            ctx.fillStyle = '#000000'
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            // Draw "Subscribe for more" Banner
            const bannerHeight = canvas.height * 0.05 // 5% of height
            ctx.fillStyle = '#ff0000'
            ctx.fillRect(0, 0, canvas.width, bannerHeight)

            ctx.fillStyle = '#ffffff'
            ctx.font = `bold ${Math.round(bannerHeight * 0.6)}px Arial`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText("Subscribe for more", canvas.width / 2, bannerHeight / 2)

            // Draw Media Overlay - Per Word
            const currentSentence = project.sentences[currentSentenceIndex]
            if (currentSentence && currentSentence.words) {
                const sentenceStart = timeline.find(t => t.sentenceId === currentSentence.id)?.startTime || 0
                const timeInSentence = currentTime - sentenceStart

                // Calculate approximate word timing
                const sentenceDuration = timeline.find(t => t.sentenceId === currentSentence.id)?.duration || 0
                const wordCount = currentSentence.words.length
                const wordDuration = sentenceDuration / wordCount

                // Find which word we're currently on
                const currentWordIndex = Math.floor(timeInSentence / wordDuration)
                const currentWord = currentSentence.words[currentWordIndex]

                // Display media for current word
                if (currentWord && currentWord.mediaUrl) {
                    const size = 400

                    const x = (canvas.width - size) / 2

                    let y
                    if (captionSettings.swapPosition) {
                        // Bottom
                        y = (canvas.height * 0.75) - (size / 2)
                    } else {
                        // Center
                        y = (canvas.height - size) / 2
                    }

                    if (currentWord.mediaType === 'video') {
                        // Video Overlay Logic
                        let videoEl = document.getElementById(`overlay-video-${currentWord.id}`) as HTMLVideoElement
                        if (!videoEl) {
                            videoEl = document.createElement('video')
                            videoEl.id = `overlay-video-${currentWord.id}`
                            videoEl.src = currentWord.mediaUrl
                            videoEl.crossOrigin = "anonymous"
                            videoEl.muted = true
                            videoEl.loop = true
                            videoEl.style.display = 'none'
                            document.body.appendChild(videoEl)
                            videoEl.play().catch(e => console.error("Overlay video play error:", e))
                        }

                        // Sync video time (optional, but good for loops)
                        // For simple loops, just letting it play is often enough, 
                        // but if we want it to restart on word start:
                        // if (Math.abs(videoEl.currentTime - (timeInSentence % videoEl.duration)) > 0.5) {
                        //     videoEl.currentTime = timeInSentence % videoEl.duration
                        // }

                        if (videoEl.readyState >= 2) {
                            ctx.drawImage(videoEl, x, y, size, size)
                        }
                    } else {
                        // Image Overlay Logic
                        const img = new Image()
                        img.src = currentWord.mediaUrl
                        ctx.drawImage(img, x, y, size, size)
                    }
                }
            }

            // Draw Captions
            if (currentSentence && currentSentence.words) {
                const weight = captionSettings.fontWeight === 'extra-bold' ? '900' : captionSettings.fontWeight
                const style = captionSettings.isItalic ? 'italic' : 'normal'
                ctx.font = `${style} ${weight} ${captionSettings.fontSize}px ${captionSettings.fontFamily}`

                ctx.fillStyle = captionSettings.textColor
                ctx.textAlign = "center"
                ctx.textBaseline = "middle"

                // Multi-line text wrapping
                // Multi-line text wrapping
                const xPos = canvas.width / 2
                let yPos
                if (captionSettings.swapPosition) {
                    yPos = canvas.height * 0.15
                } else {
                    yPos = (captionSettings.paddingTop / 100) * canvas.height
                }

                const words = currentSentence.words.map(w => {
                    let t = w.displayText
                    if (captionSettings.isUppercase) t = t.toUpperCase()
                    return t
                })

                const maxWidth = canvas.width * 0.8
                const lineHeight = captionSettings.fontSize * 1.3
                const lines: string[] = []
                let currentLine = words[0]

                for (let i = 1; i < words.length; i++) {
                    const word = words[i]
                    const width = ctx.measureText(currentLine + " " + word).width
                    if (width < maxWidth) {
                        currentLine += " " + word
                    } else {
                        lines.push(currentLine)
                        currentLine = word
                    }
                }
                lines.push(currentLine)

                // Draw lines
                const totalHeight = lines.length * lineHeight
                let startY = yPos - (totalHeight / 2) + (lineHeight / 2)

                lines.forEach((line, i) => {
                    const lineY = startY + (i * lineHeight)

                    if (captionSettings.hasBackground) {
                        const metrics = ctx.measureText(line)
                        const bgHeight = captionSettings.fontSize * 1.2
                        const bgWidth = metrics.width + 40
                        ctx.fillStyle = "rgba(0,0,0,0.5)"
                        ctx.fillRect(xPos - bgWidth / 2, lineY - bgHeight / 2, bgWidth, bgHeight)
                        ctx.fillStyle = captionSettings.textColor
                    }

                    if (captionSettings.hasShadow) {
                        ctx.shadowColor = captionSettings.shadowColor
                        ctx.shadowBlur = 0
                        ctx.shadowOffsetX = captionSettings.shadowSize
                        ctx.shadowOffsetY = captionSettings.shadowSize
                    } else {
                        ctx.shadowColor = "transparent"
                    }

                    ctx.fillText(line, xPos, lineY)
                })
            }

            // Draw Watermark
            if (watermarkImg.complete && watermarkImg.naturalWidth > 0) {
                ctx.globalAlpha = 0.5
                const wmWidth = canvas.width * 0.15
                const wmHeight = wmWidth * (watermarkImg.height / watermarkImg.width)
                const wmX = canvas.width - wmWidth - 20
                const wmY = canvas.height - wmHeight - 20
                ctx.drawImage(watermarkImg, wmX, wmY, wmWidth, wmHeight)
                ctx.globalAlpha = 1.0
            }

            requestAnimationFrame(render)
        }

        const id = requestAnimationFrame(render)
        return () => cancelAnimationFrame(id)
    }, [project, currentSentenceIndex, captionSettings, currentTime, timeline])

    // Auto-scroll to active sentence
    useEffect(() => {
        if (currentSentenceIndex !== -1) {
            const el = document.getElementById(`sentence-${currentSentenceIndex}`)
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
        }
    }, [currentSentenceIndex])
    const [isSignedIn, setIsSignedIn] = useState(false)

    useEffect(() => {
        const checkSignIn = () => {
            const hasToken = document.cookie.includes('google_auth_status=true')
            setIsSignedIn(hasToken)
        }
        checkSignIn()
        // Check periodically in case cookie expires or is cleared
        const interval = setInterval(checkSignIn, 1000)
        return () => clearInterval(interval)
    }, [])

    return (
        <div className="h-screen bg-background text-foreground flex flex-col">
            <Navbar />

            <main className="flex-1 flex overflow-hidden">
                {/* Sidebar - Settings & Content (Left 50%) */}
                <div className="w-1/2 border-r border-border/40 bg-card/30 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-border/40 flex gap-2">
                        <Button
                            variant={activeTab === 'settings' ? 'secondary' : 'ghost'}
                            onClick={() => setActiveTab('settings')}
                            className="flex-1"
                        >
                            Settings
                        </Button>
                        <Button
                            variant={activeTab === 'content' ? 'secondary' : 'ghost'}
                            onClick={() => setActiveTab('content')}
                            className="flex-1"
                        >
                            Content
                        </Button>
                    </div>

                    {/* Save Status Indicator */}
                    <div className="px-4 py-2 text-xs text-muted-foreground flex items-center justify-end gap-2 border-b border-border/40 bg-background/20">
                        {saveStatus === 'saving' && (
                            <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Saving changes...</span>
                            </>
                        )}
                        {saveStatus === 'saved' && (
                            <span className="text-green-500/80">All changes saved</span>
                        )}
                        {saveStatus === 'error' && (
                            <span className="text-red-500">Failed to save</span>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {activeTab === 'content' ? (
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <Label>Import Script</Label>
                                    <div className="space-y-2">
                                        <textarea
                                            value={scriptText}
                                            onChange={(e) => setScriptText(e.target.value)}
                                            placeholder="Paste your script here... Sentences will be split automatically."
                                            className="w-full min-h-[100px] p-3 rounded-md bg-background/50 border border-border/50 text-sm resize-y focus:outline-none focus:border-primary/50"
                                        />
                                        <div className="flex gap-2">
                                            <Button onClick={handleImportCustomScript} variant="secondary" className="flex-1 gap-2">
                                                <Type className="w-4 h-4" /> Import Script
                                            </Button>

                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-blue-400" />
                                        <Label className="text-blue-100">AI Magic</Label>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Auto-generate overlays and sound effects.
                                    </p>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1 bg-blue-500/10 border-blue-500/20 text-blue-600 hover:bg-blue-500/20 hover:text-blue-500"
                                            onClick={handleAiMagic}
                                            disabled={isAiProcessing}
                                        >
                                            {isAiProcessing ? (
                                                <>
                                                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                                                    Generating...
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles className="w-3 h-3 mr-2" />
                                                    Auto-Generate
                                                </>
                                            )}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="bg-red-500/10 border-red-500/20 text-red-600 hover:bg-red-500/20 hover:text-red-500"
                                            onClick={() => {
                                                if (!project) return
                                                const newSentences = project.sentences.map(s => ({
                                                    ...s,
                                                    words: s.words?.map(w => ({
                                                        ...w,
                                                        soundEffect: 'none',
                                                        mediaUrl: undefined,
                                                        mediaType: undefined
                                                    }))
                                                }))
                                                setProject({ ...project, sentences: newSentences })
                                                success("Overlays cleared!")
                                            }}
                                            title="Clear all overlays"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded-full bg-orange-500/20 flex items-center justify-center">
                                            <span className="text-[10px] font-bold text-orange-500">G</span>
                                        </div>
                                        <Label className="text-orange-100">Google Account</Label>
                                        {isSignedIn && (
                                            <span className="ml-auto text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30">
                                                Signed In
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Sign in to enable AI features (Gemini, TTS).
                                    </p>
                                    <div className="flex gap-2">
                                        {!isSignedIn ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full bg-orange-500/10 border-orange-500/20 text-orange-600 hover:bg-orange-500/20 hover:text-orange-500"
                                                onClick={() => {
                                                    window.location.href = '/api/auth/signin'
                                                }}
                                            >
                                                Sign In
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full bg-red-500/10 border-red-500/20 text-red-600 hover:bg-red-500/20 hover:text-red-500"
                                                onClick={() => {
                                                    document.cookie = 'google_access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
                                                    document.cookie = 'google_refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
                                                    document.cookie = 'google_auth_status=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
                                                    window.location.reload()
                                                }}
                                            >
                                                Sign Out
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <Label>Script</Label>
                                    <div className="space-y-6">
                                        {project?.sentences.map((sentence, idx) => (
                                            <Popover key={sentence.id}>
                                                <PopoverTrigger asChild>
                                                    <div
                                                        id={`sentence-${idx}`}
                                                        className={`relative p-4 rounded-xl border transition-all cursor-pointer ${idx === currentSentenceIndex
                                                            ? 'bg-primary/5 border-primary/30 shadow-sm'
                                                            : 'bg-card/30 border-border/40 hover:border-border/60'
                                                            }`}
                                                        onClick={() => {
                                                            const time = timeline.find(t => t.sentenceId === sentence.id)?.startTime
                                                            if (time !== undefined) {
                                                                setCurrentTime(time)
                                                                syncPlayback(time, true)
                                                            }
                                                        }}
                                                    >
                                                        <div className="flex flex-wrap gap-2">
                                                            {sentence.words?.map((word) => (
                                                                <Popover key={word.id}>
                                                                    <PopoverTrigger asChild>
                                                                        <button
                                                                            className="px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all hover:scale-105 active:scale-95 text-left"
                                                                            style={{
                                                                                backgroundColor: 'rgba(255,255,255,0.05)',
                                                                                border: '1px solid rgba(255,255,255,0.1)',
                                                                                color: 'inherit'
                                                                            }}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            <div className="flex items-center gap-1.5">
                                                                                <span>{word.displayText}</span>
                                                                                {word.isLineBreak && <span className="text-[10px] opacity-50">↵</span>}
                                                                                {word.soundEffect && word.soundEffect !== 'none' && <Volume2 className="w-3 h-3 opacity-70" />}
                                                                                {word.mediaUrl && <ImageIcon className="w-3 h-3 opacity-70" />}
                                                                            </div >
                                                                        </button >
                                                                    </PopoverTrigger >
                                                                    <PopoverContent className="w-80 p-4 bg-[#1a1b26] border-border/20 text-white z-50" onClick={(e) => e.stopPropagation()}>
                                                                        {/* Word Settings Content */}
                                                                        <div className="space-y-4">


                                                                            <div className="space-y-2">
                                                                                <Label className="text-xs text-muted-foreground">Sound effect</Label>
                                                                                <Select
                                                                                    value={word.soundEffect || "none"}
                                                                                    onValueChange={(val) => updateWord(sentence.id, word.id, { soundEffect: val })}
                                                                                >
                                                                                    <SelectTrigger className="bg-background/50 h-8 text-xs">
                                                                                        <SelectValue placeholder="Select sound" />
                                                                                    </SelectTrigger>
                                                                                    <SelectContent>
                                                                                        {SOUND_EFFECTS.map(s => (
                                                                                            <SelectItem key={s.id} value={s.id}>
                                                                                                <div className="flex items-center gap-2">
                                                                                                    <Volume2 className="w-4 h-4" />
                                                                                                    {s.name}
                                                                                                </div>
                                                                                            </SelectItem>
                                                                                        ))}
                                                                                    </SelectContent>
                                                                                </Select>
                                                                            </div>

                                                                            <div className="space-y-2">
                                                                                <Label className="text-xs text-muted-foreground">Media</Label>
                                                                                <div className="flex flex-col gap-2">
                                                                                    <Input
                                                                                        placeholder="Image/Video URL"
                                                                                        value={word.mediaUrl || ""}
                                                                                        onChange={(e) => {
                                                                                            const url = e.target.value
                                                                                            const type = url.match(/\.(mp4|webm|ogg|mov)$/i) ? 'video' : 'image'
                                                                                            updateWord(sentence.id, word.id, { mediaUrl: url, mediaType: type })
                                                                                        }}
                                                                                        className="h-8 bg-background/50 text-xs"
                                                                                    />
                                                                                    <div className="relative">
                                                                                        <Button variant="outline" size="sm" className="w-full bg-background/50 h-8 text-xs gap-2">
                                                                                            <ImageIcon className="w-3 h-3" /> Upload File
                                                                                        </Button>
                                                                                        <input
                                                                                            type="file"
                                                                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                                                                            accept="image/*,video/*"
                                                                                            onChange={(e) => {
                                                                                                const file = e.target.files?.[0]
                                                                                                if (file) {
                                                                                                    const url = URL.createObjectURL(file)
                                                                                                    const type = file.type.startsWith('video/') ? 'video' : 'image'
                                                                                                    updateWord(sentence.id, word.id, { mediaUrl: url, mediaType: type })
                                                                                                }
                                                                                            }}
                                                                                        />
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                className="w-full bg-purple-500/10 border-purple-500/20 text-purple-600 hover:bg-purple-500/20 hover:text-purple-500 text-xs gap-2"
                                                                                onClick={() => handleGenerateWordOverlay(sentence.id, word.id, word.displayText)}
                                                                                disabled={generatingWordId === word.id}
                                                                            >
                                                                                {generatingWordId === word.id ? (
                                                                                    <>
                                                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                                                        Generating...
                                                                                    </>
                                                                                ) : (
                                                                                    <>
                                                                                        <Sparkles className="w-3 h-3" />
                                                                                        Generate with AI
                                                                                    </>
                                                                                )}
                                                                            </Button>


                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                className="w-full bg-red-500/10 border-red-500/20 text-red-600 hover:bg-red-500/20 hover:text-red-500 text-xs gap-2"
                                                                                onClick={() => {
                                                                                    updateWord(sentence.id, word.id, {
                                                                                        soundEffect: 'none',
                                                                                        mediaUrl: undefined,
                                                                                        mediaType: undefined
                                                                                    })
                                                                                }}
                                                                            >
                                                                                <Trash2 className="w-3 h-3" />
                                                                                Clear Overlays
                                                                            </Button>
                                                                        </div>
                                                                    </PopoverContent>
                                                                </Popover >
                                                            ))
                                                            }
                                                        </div >

                                                        {/* Sentence Actions */}
                                                        < div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1" >
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-6 w-6 hover:text-primary"
                                                                title="Regenerate Audio"
                                                                disabled={sentence.isGenerating}
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    handleRegenerateSentenceAudio(sentence.id)
                                                                }}
                                                            >
                                                                {sentence.isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                                            </Button>
                                                        </div >

                                                        {/* Insert Button */}
                                                        < div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10 opacity-0 group-hover/sentence:opacity-100 transition-opacity" >
                                                            <Button
                                                                variant="secondary"
                                                                size="icon"
                                                                className="h-6 w-6 rounded-full shadow-md"
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    addSentence(idx)
                                                                }}
                                                            >
                                                                <Plus className="w-3 h-3" />
                                                            </Button>
                                                        </div >
                                                    </div >
                                                </PopoverTrigger >
                                                <PopoverContent className="w-96 p-4 bg-[#1a1b26] border-border/20 text-white z-40" align="start" sideOffset={-10}>
                                                    <div className="space-y-4">
                                                        <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                                                            <Settings className="w-4 h-4 text-primary" />
                                                            <h4 className="font-medium text-sm">Sentence Settings</h4>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <Label className="text-xs text-muted-foreground">Text</Label>
                                                            <textarea
                                                                value={sentence.text}
                                                                onChange={(e) => updateSentence(sentence.id, { text: e.target.value })}
                                                                className="w-full min-h-[80px] p-2 rounded bg-background/50 border border-white/10 text-sm resize-y focus:outline-none focus:border-primary/50"
                                                            />
                                                        </div>

                                                        <div className="space-y-2">
                                                            <Label className="text-xs text-muted-foreground">Voice</Label>
                                                            <Select
                                                                value={sentence.voice}
                                                                onValueChange={(val) => updateSentence(sentence.id, { voice: val })}
                                                            >
                                                                <SelectTrigger className="bg-background/50 h-8 text-xs">
                                                                    <SelectValue placeholder="Select voice" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {VOICE_MODELS.map(v => (
                                                                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <div className="flex justify-between text-xs">
                                                                <Label className="text-muted-foreground">Speed</Label>
                                                                <span className="text-xs">{sentence.speed || 1}x</span>
                                                            </div>
                                                            <Slider
                                                                value={[sentence.speed || 1]}
                                                                min={0.25}
                                                                max={4.0}
                                                                step={0.25}
                                                                onValueChange={(vals) => updateSentence(sentence.id, { speed: vals[0] })}
                                                            />
                                                        </div>
                                                    </div>
                                                </PopoverContent>
                                            </Popover >
                                        ))}
                                    </div >
                                </div >
                            </div >
                        ) : (
                            /* Settings Tab Content */
                            <>
                                {/* Captions Section */}
                                <div className="pt-4 space-y-4">
                                    <button
                                        onClick={() => setIsCaptionsOpen(!isCaptionsOpen)}
                                        className="flex items-center justify-between w-full text-sm font-medium hover:text-primary transition-colors"
                                    >
                                        <span>Captions</span>
                                        {isCaptionsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>

                                    {isCaptionsOpen && (
                                        <div className="space-y-6 animate-in slide-in-from-top-2 duration-200">
                                            <div className="space-y-4">
                                                <Label className="text-xs text-muted-foreground">Text</Label>

                                                <div className="flex gap-2">
                                                    <Select
                                                        value={captionSettings.fontFamily}
                                                        onValueChange={(val) => setCaptionSettings({ ...captionSettings, fontFamily: val })}
                                                    >
                                                        <SelectTrigger className="flex-1 bg-background/50">
                                                            <SelectValue placeholder="Font" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {FONT_OPTIONS.map(font => (
                                                                <SelectItem key={font} value={font}>{font}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <Input
                                                        type="number"
                                                        className="w-20 bg-background/50"
                                                        value={captionSettings.fontSize}
                                                        onChange={(e) => setCaptionSettings({ ...captionSettings, fontSize: Number(e.target.value) })}
                                                    />
                                                </div>

                                                <div className="flex items-center justify-between">
                                                    <div className="flex gap-1 bg-background/50 p-1 rounded-md border border-border/50">
                                                        <Button
                                                            variant={captionSettings.fontWeight === 'extra-bold' ? 'secondary' : 'ghost'}
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => setCaptionSettings({ ...captionSettings, fontWeight: 'extra-bold' })}
                                                        >
                                                            <span className="font-black text-lg">B</span>
                                                        </Button>
                                                        <Button
                                                            variant={captionSettings.fontWeight === 'bold' ? 'secondary' : 'ghost'}
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => setCaptionSettings({ ...captionSettings, fontWeight: 'bold' })}
                                                        >
                                                            <Bold className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant={captionSettings.isItalic ? 'secondary' : 'ghost'}
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => setCaptionSettings({ ...captionSettings, isItalic: !captionSettings.isItalic })}
                                                        >
                                                            <Italic className="w-4 h-4" />
                                                        </Button>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <Label className="text-xs">Text color</Label>
                                                        <div className="relative w-8 h-8 rounded-md overflow-hidden border border-border/50">
                                                            <input
                                                                type="color"
                                                                className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer p-0 border-0"
                                                                value={captionSettings.textColor}
                                                                onChange={(e) => setCaptionSettings({ ...captionSettings, textColor: e.target.value })}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between">
                                                    <Label className="text-xs">Upper case</Label>
                                                    <Switch
                                                        checked={captionSettings.isUppercase}
                                                        onCheckedChange={(checked) => setCaptionSettings({ ...captionSettings, isUppercase: checked })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-4 pt-4 border-t border-border/30">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Switch
                                                            checked={captionSettings.hasShadow}
                                                            onCheckedChange={(checked) => setCaptionSettings({ ...captionSettings, hasShadow: checked })}
                                                        />
                                                        <Label className="text-xs">Shadow</Label>
                                                    </div>

                                                    {captionSettings.hasShadow && (
                                                        <div className="flex items-center gap-2">
                                                            <div className="relative w-6 h-6 rounded-md overflow-hidden border border-border/50">
                                                                <input
                                                                    type="color"
                                                                    className="absolute -top-2 -left-2 w-10 h-10 cursor-pointer p-0 border-0"
                                                                    value={captionSettings.shadowColor}
                                                                    onChange={(e) => setCaptionSettings({ ...captionSettings, shadowColor: e.target.value })}
                                                                />
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <Label className="text-[10px] text-muted-foreground">Size</Label>
                                                                <Input
                                                                    type="number"
                                                                    className="w-12 h-6 text-xs bg-background/50"
                                                                    value={captionSettings.shadowSize}
                                                                    onChange={(e) => setCaptionSettings({ ...captionSettings, shadowSize: Number(e.target.value) })}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Switch
                                                            checked={captionSettings.hasBackground}
                                                            onCheckedChange={(checked) => setCaptionSettings({ ...captionSettings, hasBackground: checked })}
                                                        />
                                                        <Label className="text-xs">Background</Label>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-2 pt-4 border-t border-border/30">
                                                <div className="flex justify-between text-xs">
                                                    <Label>Padding Top</Label>
                                                    <span className="text-muted-foreground">{captionSettings.paddingTop}%</span>
                                                </div>
                                                <Slider
                                                    value={[captionSettings.paddingTop]}
                                                    min={0}
                                                    max={100}
                                                    step={1}
                                                    onValueChange={(vals) => setCaptionSettings({ ...captionSettings, paddingTop: vals[0] })}
                                                />
                                            </div>


                                            {/* Swap Position Toggle */}
                                            <div className="flex items-center justify-between pt-4 border-t border-border/30">
                                                <div className="flex flex-col gap-0.5">
                                                    <Label className="text-xs">Swap Position</Label>
                                                    <span className="text-[10px] text-muted-foreground">Text Top / Media Bottom</span>
                                                </div>
                                                <Switch
                                                    checked={captionSettings.swapPosition || false}
                                                    onCheckedChange={(checked) => setCaptionSettings({ ...captionSettings, swapPosition: checked })}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div >

                    {/* Export Controls (Moved to Left Sidebar Footer) */}
                    < div className="p-4 border-t border-border/40 bg-background/50 space-y-4" >


                        <div className="flex gap-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button className="flex-1 gap-2" disabled={isExporting}>
                                        {isExporting ? (
                                            <div className="flex flex-col items-start gap-0.5 w-full">
                                                <div className="flex items-center gap-2 w-full">
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    <span className="font-medium">
                                                        {exportPhase === 'preloading' ? 'Overlay dosyaları indiriliyor...' :
                                                            exportPhase === 'generating' ? `Generating Frames ${exportProgress}%` :
                                                                exportPhase === 'zipping' ? `Zipping ${exportProgress}%` :
                                                                    `Uploading ${exportProgress}%`}
                                                    </span>
                                                </div>
                                                {contextStatus && (
                                                    <span className="text-[10px] text-muted-foreground pl-6">
                                                        {contextStatus}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <>
                                                <Download className="w-4 h-4" /> Download Video
                                            </>
                                        )}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem onClick={() => handleDownload('mp4', true)}>
                                        Download Video (MP4)
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>

                        </div>
                    </div >
                </div >

                {/* Main Preview Area (Right 50%) */}
                < div className="w-1/2 flex flex-col items-center justify-center bg-black/20 p-8 relative border-l border-border/40" >
                    <div className="relative aspect-[9/16] h-[80vh] bg-black rounded-lg overflow-hidden shadow-2xl border border-border/20">
                        {/* Video Player - Hidden in preview for performance */}
                        <video
                            ref={videoRef}
                            className="absolute opacity-0 pointer-events-none -z-50"
                            src={project?.backgroundVideo || "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"}
                            // onTimeUpdate={handleTimeUpdate} // Driven by animation loop now
                            loop
                            muted // Mute background video to hear TTS
                            crossOrigin="anonymous"
                            preload="auto"
                        />

                        {/* Audio Elements */}
                        <audio ref={audioRef} className="hidden" />
                        <audio ref={soundEffectRef} className="hidden" />

                        {/* Hidden Canvas for Rendering */}
                        <canvas
                            ref={canvasRef}
                            width={1080}
                            height={1920}
                            className="hidden"
                        />

                        {/* Media Overlay - Per Word (3 second duration) */}
                        {(() => {
                            const currentSentence = project?.sentences[currentSentenceIndex]
                            if (!currentSentence || !currentSentence.words || !timeline.length) return null

                            const sentenceTimeline = timeline.find(t => t.sentenceId === currentSentence.id)
                            if (!sentenceTimeline) return null

                            const wordCount = currentSentence.words.length
                            const wordDuration = sentenceTimeline.duration / wordCount

                            // Find active media
                            let activeMediaUrl = null
                            for (let i = 0; i < wordCount; i++) {
                                const word = currentSentence.words[i]
                                if (word.mediaUrl) {
                                    const wordStartTime = sentenceTimeline.startTime + (i * wordDuration)
                                    const timeSinceWordStart = currentTime - wordStartTime

                                    if (timeSinceWordStart >= 0 && timeSinceWordStart <= 3.0) {
                                        activeMediaUrl = word.mediaUrl
                                    }
                                }
                            }

                            if (!activeMediaUrl) return null

                            const isVideo = activeMediaUrl.match(/\.(mp4|webm|ogg|mov)$/i) || activeMediaUrl.startsWith('blob:') // Blob might be video, but we can't easily check here without mediaType. 
                            // Better to use the word.mediaType we added.
                            // We need to find the word again or pass it.
                            // The loop above found activeMediaUrl but didn't save the word.
                            // Let's refactor slightly to get the word.

                            let activeMediaType = 'image'
                            // Re-find the word (or we could have saved it in the loop)
                            for (let i = 0; i < wordCount; i++) {
                                const word = currentSentence.words[i]
                                if (word.mediaUrl === activeMediaUrl) {
                                    activeMediaType = word.mediaType || 'image'
                                    break
                                }
                            }

                            return (
                                <div className={`absolute inset-0 flex justify-center w-full px-8 pointer-events-none ${captionSettings.swapPosition ? 'items-end pb-[20%]' : 'items-center pb-[20%]'}`}>
                                    {activeMediaType === 'video' ? (
                                        <video
                                            src={activeMediaUrl}
                                            autoPlay
                                            loop
                                            muted
                                            className="w-full max-w-md object-contain rounded-lg shadow-2xl"
                                        />
                                    ) : (
                                        <img
                                            src={activeMediaUrl}
                                            alt="Word media"
                                            className="w-full max-w-md object-contain rounded-lg shadow-2xl"
                                        />
                                    )}
                                </div>
                            )
                        })()}

                        {/* Overlay Captions (HTML Overlay for Preview) */}
                        <div
                            className="absolute left-0 right-0 text-center px-4 flex flex-wrap justify-center content-end gap-2"
                            style={{
                                bottom: captionSettings.swapPosition ? 'auto' : '15%',
                                top: captionSettings.swapPosition ? '15%' : 'auto',
                                pointerEvents: 'auto'
                            }}
                        >
                            {project?.sentences[currentSentenceIndex]?.words?.map((word) => (
                                <Popover key={word.id}>
                                    <PopoverTrigger asChild>
                                        <span
                                            className="cursor-pointer hover:scale-105 transition-transform select-none px-1 rounded border border-transparent hover:border-white/50 hover:bg-white/10"
                                            style={{
                                                fontFamily: captionSettings.fontFamily,
                                                fontSize: `${captionSettings.fontSize / 2}px`,
                                                fontWeight: captionSettings.fontWeight === 'extra-bold' ? 900 : captionSettings.fontWeight,
                                                fontStyle: captionSettings.isItalic ? 'italic' : 'normal',
                                                color: captionSettings.textColor,
                                                textTransform: captionSettings.isUppercase ? 'uppercase' : 'none',
                                                textShadow: captionSettings.hasShadow
                                                    ? `${captionSettings.shadowSize / 2}px ${captionSettings.shadowSize / 2}px 0px ${captionSettings.shadowColor}`
                                                    : 'none',
                                                backgroundColor: captionSettings.hasBackground ? 'rgba(0,0,0,0.5)' : 'transparent',
                                                padding: captionSettings.hasBackground ? '4px 8px' : '0 2px',
                                                borderRadius: '4px'
                                            }}
                                        >
                                            {word.displayText}
                                        </span>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80 p-4 bg-[#1a1b26] border-border/20 text-white">
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">Sound effect</Label>
                                                <Select
                                                    value={word.soundEffect || "none"}
                                                    onValueChange={(val) => updateWord(project.sentences[currentSentenceIndex].id, word.id, { soundEffect: val })}
                                                >
                                                    <SelectTrigger className="bg-background/50 h-8">
                                                        <SelectValue placeholder="Select sound" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {SOUND_EFFECTS.map(s => (
                                                            <SelectItem key={s.id} value={s.id}>
                                                                <div className="flex items-center gap-2">
                                                                    <Volume2 className="w-4 h-4" />
                                                                    {s.name}
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">Media</Label>
                                                <div className="flex flex-col gap-2">
                                                    <Input
                                                        placeholder="Image/Video URL"
                                                        value={word.mediaUrl || ""}
                                                        onChange={(e) => {
                                                            const url = e.target.value
                                                            const type = url.match(/\.(mp4|webm|ogg|mov)$/i) ? 'video' : 'image'
                                                            updateWord(project.sentences[currentSentenceIndex].id, word.id, { mediaUrl: url, mediaType: type })
                                                        }}
                                                        className="h-8 bg-background/50 text-xs"
                                                    />
                                                    <div className="relative">
                                                        <Button variant="outline" size="sm" className="w-full bg-background/50 h-8 text-xs gap-2">
                                                            <ImageIcon className="w-3 h-3" /> Upload File
                                                        </Button>
                                                        <input
                                                            type="file"
                                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                                            accept="image/*,video/*"
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0]
                                                                if (file) {
                                                                    const url = URL.createObjectURL(file)
                                                                    const type = file.type.startsWith('video/') ? 'video' : 'image'
                                                                    updateWord(project.sentences[currentSentenceIndex].id, word.id, { mediaUrl: url, mediaType: type })
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full bg-purple-500/10 border-purple-500/20 text-purple-600 hover:bg-purple-500/20 hover:text-purple-500 text-xs gap-2"
                                                onClick={() => handleGenerateWordOverlay(project.sentences[currentSentenceIndex].id, word.id, word.displayText)}
                                                disabled={generatingWordId === word.id}
                                            >
                                                {generatingWordId === word.id ? (
                                                    <>
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                        Generating...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles className="w-3 h-3" />
                                                        Generate with AI
                                                    </>
                                                )}
                                            </Button>


                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full bg-red-500/10 border-red-500/20 text-red-600 hover:bg-red-500/20 hover:text-red-500 text-xs gap-2"
                                                onClick={() => {
                                                    updateWord(project.sentences[currentSentenceIndex].id, word.id, {
                                                        soundEffect: 'none',
                                                        mediaUrl: undefined,
                                                        mediaType: undefined
                                                    })
                                                }}
                                            >
                                                <Trash2 className="w-3 h-3" />
                                                Clear Overlays
                                            </Button>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            ))}
                        </div>

                        {/* Controls Overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex flex-col gap-2 pointer-events-none">
                            {/* Scrubber */}
                            <div className="w-full px-2 pointer-events-auto">
                                <Slider
                                    value={[currentTime]}
                                    min={0}
                                    max={totalDuration || 100}
                                    step={0.1}
                                    onValueChange={handleSliderChange}
                                    className="cursor-pointer"
                                />
                            </div>

                            <div className="flex items-center justify-between pointer-events-auto">
                                <div className="flex items-center gap-4">
                                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={handleSkipBack}>
                                        <SkipBack className="w-6 h-6" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={togglePlay}>
                                        {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                                    </Button>
                                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={handleSkipForward}>
                                        <SkipForward className="w-6 h-6" />
                                    </Button>
                                    <span className="text-white text-xs font-mono">
                                        {currentTime.toFixed(1)}s / {totalDuration.toFixed(1)}s
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground animate-pulse">
                        💡 Tip: Click on any word in the video to edit its voice, sound, or text.
                    </p>
                </div >

            </main >
        </div >
    )
}

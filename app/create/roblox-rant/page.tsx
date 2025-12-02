"use client"

import { Navbar } from "@/components/Navbar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Trash2, Plus, Upload, Zap, Settings2, Play, LogIn, Type, Sparkles } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/providers/toast-provider"

interface Sentence {
    id: string
    text: string
    voice: string
    speed?: number
    pitch?: number
}

export default function CreateRobloxRant() {
    const router = useRouter()
    const [sentences, setSentences] = useState<Sentence[]>([])
    const [isGenerating, setIsGenerating] = useState(false)
    const [isPreviewing, setIsPreviewing] = useState(false)
    const [showAuthDialog, setShowAuthDialog] = useState(false)
    const audioRef = useRef<HTMLAudioElement | null>(null)

    // Project Title State
    const [projectTitle, setProjectTitle] = useState("My Roblox Rant")

    // Voice Settings State
    const [selectedVoice, setSelectedVoice] = useState("en-US-Journey-D")
    const [selectedModel, setSelectedModel] = useState("standard")
    const [voiceSpeed, setVoiceSpeed] = useState(1)
    const [voicePitch, setVoicePitch] = useState(0)
    const [voiceVolume, setVoiceVolume] = useState(0)
    const [scriptText, setScriptText] = useState("")
    const [backgrounds, setBackgrounds] = useState<string[]>([])
    const [selectedBackground, setSelectedBackground] = useState<string>("")
    const [backgroundThumbnail, setBackgroundThumbnail] = useState<string>("")
    const [estimatedDuration, setEstimatedDuration] = useState(0)
    const [isDragging, setIsDragging] = useState(false)
    const { error: showError, success } = useToast()

    // Fetch backgrounds on mount
    useEffect(() => {
        fetch('/api/backgrounds')
            .then(res => res.json())
            .then(data => {
                if (data.videos && data.videos.length > 0) {
                    setBackgrounds(data.videos)
                    setSelectedBackground(data.videos[0])
                }
            })
            .catch(err => console.error("Failed to fetch backgrounds:", err))
    }, [])

    // Calculate estimated duration
    useEffect(() => {
        let duration = 0
        sentences.forEach(s => {
            const wordCount = s.text.split(/\s+/).length
            // Approx 0.4s per word / speed + 0.5s pause
            duration += ((wordCount * 0.4) / voiceSpeed) + 0.5
        })
        setEstimatedDuration(Math.ceil(duration))
    }, [sentences, voiceSpeed])

    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60)
        const s = seconds % 60
        return `${m}m ${s}s`
    }

    const voices = [
        // Journey (Expressive)
        { name: "Journey (US Male)", id: "en-US-Journey-D", model: "standard" },
        { name: "Journey (US Female)", id: "en-US-Journey-F", model: "standard" },

        // Casual
        { name: "Casual (US Male)", id: "en-US-Casual-K", model: "standard" },

        // Studio (High Quality)
        { name: "Studio (US Male)", id: "en-US-Studio-M", model: "standard" },
        { name: "Studio (US Female)", id: "en-US-Studio-O", model: "standard" },

        // Neural2 (Premium)
        { name: "Neural2 (US Male 1)", id: "en-US-Neural2-A", model: "standard" },
        { name: "Neural2 (US Female 1)", id: "en-US-Neural2-C", model: "standard" },
        { name: "Neural2 (US Male 2)", id: "en-US-Neural2-D", model: "standard" },
        { name: "Neural2 (US Female 2)", id: "en-US-Neural2-F", model: "standard" },
        { name: "Neural2 (US Female 3)", id: "en-US-Neural2-H", model: "standard" },

        // News (Professional)
        { name: "News (US Female)", id: "en-US-News-K", model: "standard" },
        { name: "News (US Male)", id: "en-US-News-N", model: "standard" },

        // Polyglot
        { name: "Polyglot (US Male)", id: "en-US-Polyglot-1", model: "standard" }
    ]

    const handlePreviewVoice = async () => {
        if (isPreviewing) return
        setIsPreviewing(true)

        try {
            const response = await fetch('/api/vertex/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: "Hello, this is a sample of my voice.",
                    voiceName: selectedVoice,
                    modelName: selectedModel,
                    speed: voiceSpeed,
                    pitch: 0, // Keep sending 0 to API for consistency, we handle pitch client-side
                    volume: voiceVolume,
                    prompt: "Say this in a clear and engaging way"
                })
            })

            if (!response.ok) {
                const errorData = await response.json()
                if (response.status === 500 && (errorData.error?.includes("No refresh token") || errorData.error?.includes("login"))) {
                    setShowAuthDialog(true)
                    setIsPreviewing(false)
                    return
                }
                throw new Error(errorData.error || 'Failed to generate preview')
            }

            const data = await response.json()
            const audioContent = data.audioContent

            // Decode base64
            const byteCharacters = atob(audioContent)
            const byteNumbers = new Array(byteCharacters.length)
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i)
            }
            const byteArray = new Uint8Array(byteNumbers)
            const arrayBuffer = byteArray.buffer

            // Use AudioContext for pitch shifting
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext
            const audioCtx = new AudioContext()
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)

            const source = audioCtx.createBufferSource()
            source.buffer = audioBuffer

            // Apply pitch shift (detune is in cents, 100 cents = 1 semitone)
            if (voicePitch !== 0) {
                source.detune.value = voicePitch * 100
            }

            source.connect(audioCtx.destination)
            source.start(0)

            source.onended = () => {
                setIsPreviewing(false)
                audioCtx.close()
            }

        } catch (error) {
            console.error("Preview failed:", error)
            setIsPreviewing(false)
            showError(`Failed to preview voice: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    const handleImportCustomScript = () => {
        if (!scriptText.trim()) return

        // Split by punctuation (. ! ?) but keep the punctuation
        const rawSentences = scriptText.match(/[^.!?]+([.!?]+|$)/g) || []

        const newSentences: Sentence[] = rawSentences.map((text, i) => {
            const cleanText = text.trim()
            if (!cleanText) return null

            return {
                id: crypto.randomUUID(),
                text: cleanText,
                voice: selectedVoice // Use the currently selected voice
            }
        }).filter((s): s is Sentence => s !== null)

        if (newSentences.length > 0) {
            setSentences([...sentences, ...newSentences])
            setScriptText("") // Clear input
        }
    }

    const handleGenerateViralScript = async () => {
        setIsGenerating(true)
        try {
            const response = await fetch('/api/gemini/script', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: scriptText || "Viral Roblox Rant",
                    type: "roblox-rant-viral"
                })
            })

            if (!response.ok) {
                if (response.status === 401) {
                    setShowAuthDialog(true)
                    throw new Error("Authentication required")
                }
                throw new Error("Failed to generate script")
            }

            const data = await response.json()

            if (data.title) {
                setProjectTitle(data.title.toUpperCase())
            }

            if (data.script) {
                // Split by punctuation (. ! ?) but keep the punctuation
                const rawSentences = data.script.match(/[^.!?]+([.!?]+|$)/g) || []

                const newSentences: Sentence[] = rawSentences.map((text: string) => {
                    const cleanText = text.trim()
                    if (!cleanText) return null

                    return {
                        id: crypto.randomUUID(),
                        text: cleanText,
                        voice: selectedVoice
                    }
                }).filter((s: any): s is Sentence => s !== null)

                if (newSentences.length > 0) {
                    setSentences([...sentences, ...newSentences])
                    success("Viral script generated successfully!")
                }
            }
        } catch (error) {
            console.error(error)
            showError("Failed to generate viral script")
        } finally {
            setIsGenerating(false)
        }
    }

    const generateThumbnail = async (file: File): Promise<Blob | null> => {
        return new Promise((resolve) => {
            const video = document.createElement('video')
            video.preload = 'metadata'
            video.muted = true
            video.playsInline = true

            video.onloadedmetadata = () => {
                video.currentTime = 1 // Seek to 1s
            }

            video.onseeked = () => {
                const canvas = document.createElement('canvas')
                canvas.width = video.videoWidth
                canvas.height = video.videoHeight
                const ctx = canvas.getContext('2d')
                ctx?.drawImage(video, 0, 0, canvas.width, canvas.height)
                canvas.toBlob((blob) => {
                    resolve(blob)
                    URL.revokeObjectURL(video.src)
                }, 'image/jpeg', 0.7)
            }

            video.onerror = () => {
                resolve(null)
                URL.revokeObjectURL(video.src)
            }

            video.src = URL.createObjectURL(file)
        })
    }

    const uploadFile = async (file: File) => {
        const formData = new FormData()
        formData.append('file', file)

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            })
            const data = await res.json()
            if (data.url) {
                setSelectedBackground(data.url)

                // Generate and upload thumbnail
                try {
                    const thumbnailBlob = await generateThumbnail(file)
                    if (thumbnailBlob) {
                        const thumbFile = new File([thumbnailBlob], "thumbnail.jpg", { type: "image/jpeg" })
                        const thumbFormData = new FormData()
                        thumbFormData.append('file', thumbFile)

                        const thumbRes = await fetch('/api/upload', {
                            method: 'POST',
                            body: thumbFormData
                        })
                        const thumbData = await thumbRes.json()
                        if (thumbData.url) {
                            setBackgroundThumbnail(thumbData.url)
                        }
                    }
                } catch (e) {
                    console.error("Thumbnail generation failed", e)
                }
            }
        } catch (err) {
            console.error("Upload failed", err)
            showError("Failed to upload video")
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            await uploadFile(file)
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)

        const file = e.dataTransfer.files?.[0]
        if (file && file.type.startsWith('video/')) {
            await uploadFile(file)
        }
    }

    const handleCreateVideo = async () => {
        setIsGenerating(true)
        try {
            // Fetch available background videos
            const bgResponse = await fetch('/api/backgrounds')
            const bgData = await bgResponse.json()
            let finalBackground = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" // Fallback

            if (selectedBackground) {
                if (selectedBackground.startsWith('/')) {
                    finalBackground = selectedBackground
                } else {
                    finalBackground = `/backgrounds/${selectedBackground}`
                }
            } else if (backgrounds.length > 0) {
                // Fallback to random if nothing selected (shouldn't happen if default set)
                const randomIndex = Math.floor(Math.random() * backgrounds.length)
                finalBackground = `/backgrounds/${backgrounds[randomIndex]}`
            }

            const generatedSentences = []
            for (const sentence of sentences) {
                // Add delay to avoid rate limits
                if (generatedSentences.length > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000))
                }

                const response = await fetch('/api/vertex/tts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: sentence.text,
                        voiceName: selectedVoice,
                        modelName: selectedModel,
                        speed: voiceSpeed,
                        pitch: voicePitch,
                        volume: voiceVolume,
                        prompt: "Say this in a clear and engaging way"
                    })
                })

                if (!response.ok) {
                    const errorData = await response.json()
                    if (response.status === 500 && (errorData.error?.includes("No refresh token") || errorData.error?.includes("login"))) {
                        setShowAuthDialog(true)
                        throw new Error("Authentication required")
                    }
                    // If rate limited, wait longer and retry once
                    if (response.status === 429) {
                        console.warn("Rate limited, waiting 5s and retrying...")
                        await new Promise(resolve => setTimeout(resolve, 5000))
                        // Retry logic could be added here, but for now just throw to stop
                        throw new Error("Rate limit exceeded. Please try again in a moment.")
                    }
                    throw new Error(errorData.error || 'Failed to generate audio')
                }

                const data = await response.json()
                generatedSentences.push({
                    ...sentence,
                    audioContent: data.audioContent,
                    speed: voiceSpeed,
                    pitch: voicePitch
                })
            }

            const projectId = crypto.randomUUID()

            // Create project via API
            const projectData = {
                id: projectId,
                type: 'roblox-rant',
                title: projectTitle || "My Roblox Rant",
                sentences: generatedSentences,
                backgroundVideo: finalBackground,
                backgroundThumbnail: backgroundThumbnail, // Add thumbnail to project
                userId: 'user-1' // TODO: Get actual user ID
            }

            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(projectData)
            })

            if (!res.ok) {
                throw new Error("Failed to create project")
            }

            router.push(`/editor/${projectId}`)
        } catch (error) {
            console.error("Generation failed:", error)
            if (error instanceof Error && error.message !== "Authentication required") {
                showError("Failed to generate video. Please try again.")
            }
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            <Navbar />

            <main className="container mx-auto px-6 py-8 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">Create Roblox Rant Video</h1>
                        <p className="text-muted-foreground">Create viral roblox rant videos in seconds</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1">
                    {/* Left Column - Settings */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Settings2 className="w-5 h-5" /> Voice Settings
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2">
                                    <Label>Voice Model</Label>
                                    <div className="flex gap-2">
                                        <Select
                                            value={`${selectedVoice}|${selectedModel}`}
                                            onValueChange={(val) => {
                                                const [vId, mId] = val.split('|')
                                                setSelectedVoice(vId)
                                                setSelectedModel(mId)
                                            }}
                                        >
                                            <SelectTrigger className="flex-1">
                                                <SelectValue placeholder="Select a voice" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {voices.map((v, i) => (
                                                    <SelectItem key={`${v.id}-${v.model}-${i}`} value={`${v.id}|${v.model}`}>
                                                        {v.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={handlePreviewVoice}
                                            disabled={isPreviewing}
                                            title="Preview Voice"
                                        >
                                            {isPreviewing ? (
                                                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                                            ) : (
                                                <Play className="w-4 h-4" />
                                            )}
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <Label>Speed ({voiceSpeed}x)</Label>
                                        </div>
                                        <Slider
                                            value={[voiceSpeed]}
                                            min={0.25}
                                            max={4.0}
                                            step={0.25}
                                            onValueChange={(vals) => setVoiceSpeed(vals[0])}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <Label>Pitch ({voicePitch})</Label>
                                        </div>
                                        <Slider
                                            value={[voicePitch]}
                                            min={-20.0}
                                            max={20.0}
                                            step={1.0}
                                            onValueChange={(vals) => setVoicePitch(vals[0])}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <Label>Volume ({voiceVolume}dB)</Label>
                                        </div>
                                        <Slider
                                            value={[voiceVolume]}
                                            min={-96.0}
                                            max={16.0}
                                            step={1.0}
                                            onValueChange={(vals) => setVoiceVolume(vals[0])}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Project Title */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Type className="w-5 h-5" /> Project Title
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Input
                                    value={projectTitle}
                                    onChange={(e) => setProjectTitle(e.target.value)}
                                    placeholder="My Roblox Rant"
                                    className="bg-background/50"
                                />
                            </CardContent>
                        </Card>

                        {/* Background Selection */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Upload className="w-5 h-5" /> Background Video
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div
                                    className={`
                                        border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                                        ${isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50 hover:bg-accent/50'}
                                    `}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={() => document.getElementById('video-upload')?.click()}
                                >
                                    <div className="flex flex-col items-center gap-2">
                                        <Upload className={`w-8 h-8 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                                        <div className="text-sm font-medium">
                                            {isDragging ? "Drop video here" : "Drag & drop or click to upload"}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Supports MP4, WebM (Max 50MB)
                                        </p>
                                    </div>
                                    <Input
                                        id="video-upload"
                                        type="file"
                                        accept="video/*"
                                        className="hidden"
                                        onChange={handleFileUpload}
                                    />
                                </div>

                                {selectedBackground && (
                                    <div className="rounded-md border p-2 bg-muted/50 text-sm break-all flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500" />
                                        <span className="font-semibold">Selected:</span>
                                        <span className="truncate">{selectedBackground.split('/').pop()}</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column - Content */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold">Script</h3>
                            {estimatedDuration > 0 && (
                                <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-1 rounded-full border border-primary/20">
                                    Est. Duration: {formatDuration(estimatedDuration)}
                                </span>
                            )}
                        </div>

                        <div className="space-y-2">
                            <textarea
                                value={scriptText}
                                onChange={(e) => setScriptText(e.target.value)}
                                placeholder="Paste your script here... Sentences will be split automatically."
                                className="w-full min-h-[100px] p-3 rounded-md bg-background/50 border border-border/50 text-sm resize-y focus:outline-none focus:border-primary/50"
                            />
                            <div className="flex gap-2">
                                <Button onClick={handleImportCustomScript} variant="secondary" className="flex-1 gap-2" suppressHydrationWarning>
                                    <Type className="w-4 h-4" /> Import Script
                                </Button>
                                <Button
                                    onClick={handleGenerateViralScript}
                                    disabled={isGenerating}
                                    variant="outline"
                                    className="flex-1 gap-2 border-primary/50 hover:bg-primary/10"
                                >
                                    {isGenerating ? (
                                        <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                                    ) : (
                                        <Sparkles className="w-4 h-4 text-yellow-500" />
                                    )}
                                    Generate Viral Script ⚡
                                </Button>
                            </div>
                        </div>

                        <div className="bg-card/30 border border-border/50 rounded-lg p-6 min-h-[400px]">
                            {sentences.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-6 text-muted-foreground">
                                    <p>No sentences yet. Add sentences to get started.</p>
                                    <Button onClick={() => setSentences([{ id: crypto.randomUUID(), text: "", voice: selectedVoice }])} variant="outline" className="gap-2">
                                        <Plus className="w-4 h-4" /> Add Sentence
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {sentences.map((sentence) => (
                                        <div key={sentence.id} className="grid grid-cols-[1fr_auto] gap-4 items-center bg-background/40 p-3 rounded-md border border-border/30 hover:border-primary/30 transition-colors group">
                                            <Input
                                                value={sentence.text}
                                                onChange={(e) => {
                                                    const newSentences = [...sentences]
                                                    const idx = newSentences.findIndex(s => s.id === sentence.id)
                                                    newSentences[idx].text = e.target.value
                                                    setSentences(newSentences)
                                                }}
                                                className="bg-transparent border-transparent focus-visible:ring-0 px-2 hover:bg-background/50 transition-colors"
                                                placeholder="Type your sentence here..."
                                            />
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => {
                                                    setSentences(sentences.filter(s => s.id !== sentence.id))
                                                }}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="flex justify-between pt-6">
                                        <Button variant="outline" size="sm" onClick={() => setSentences([...sentences, { id: crypto.randomUUID(), text: "", voice: selectedVoice }])} className="gap-2">
                                            <Plus className="w-4 h-4" /> Add Sentence
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => setSentences([])} className="text-red-500 hover:text-red-400 hover:bg-red-500/10">
                                            <Trash2 className="w-4 h-4 mr-2" /> Clear all
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end">
                            <Button onClick={handleCreateVideo} disabled={sentences.length === 0 || isGenerating} size="lg" className="bg-primary hover:bg-primary/90">
                                {isGenerating ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Zap className="w-4 h-4 mr-2" /> Create video
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>

                <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Authentication Required</DialogTitle>
                            <DialogDescription>
                                You need to sign in with Google to use the AI voice features.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowAuthDialog(false)}>
                                Cancel
                            </Button>
                            <Button onClick={() => window.location.href = '/api/auth/signin'} className="gap-2">
                                <LogIn className="w-4 h-4" /> Sign in with Google
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </main >
        </div >
    )
}

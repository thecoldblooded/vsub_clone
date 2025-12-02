"use client"

import { Navbar } from "@/components/Navbar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Settings, Plus } from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"

const STYLES = [
    { id: "creepy-cartoon", name: "Creepy Cartoon", image: "/placeholder-creepy.jpg" },
    { id: "anime", name: "Anime", image: "/placeholder-anime.jpg" },
    { id: "realistic", name: "Realistic", image: "/placeholder-realistic.jpg" },
    { id: "3d-render", name: "3D Render", image: "/placeholder-3d.jpg" },
]

export default function CreateAIVideoV2() {
    const router = useRouter()
    const [selectedStyle, setSelectedStyle] = useState(STYLES[0].id)
    const [transcript, setTranscript] = useState("")
    const [isGenerating, setIsGenerating] = useState(false)

    const handleContinue = async () => {
        setIsGenerating(true)
        // TODO: Call API to generate script/video
        // For now, just redirect to editor with a mock ID
        setTimeout(() => {
            router.push(`/editor/mock-project-id`)
        }, 1000)
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Navbar />

            <main className="container mx-auto px-6 py-8 max-w-4xl">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-2xl font-bold">Create AI videos</h1>
                </div>

                <div className="space-y-8">
                    {/* Styles */}
                    <section>
                        <Label className="text-base mb-4 block">Styles</Label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {STYLES.map((style) => (
                                <Card
                                    key={style.id}
                                    className={`cursor-pointer overflow-hidden border-2 transition-all ${selectedStyle === style.id ? 'border-primary ring-2 ring-primary/50' : 'border-transparent hover:border-primary/50'}`}
                                    onClick={() => setSelectedStyle(style.id)}
                                >
                                    <div className="aspect-[9/16] relative bg-muted">
                                        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground bg-black/50">
                                            {/* Placeholder */}
                                            <span className="text-xs">{style.name}</span>
                                        </div>
                                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/80 text-center">
                                            <span className="text-xs font-bold text-white">{style.name}</span>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </section>

                    {/* Settings */}
                    <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>Voice</Label>
                            <div className="flex gap-2">
                                <Select defaultValue="elevenlabs">
                                    <SelectTrigger className="w-[140px]">
                                        <SelectValue placeholder="Provider" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="elevenlabs">Elevenlabs</SelectItem>
                                        <SelectItem value="openai">OpenAI</SelectItem>
                                        <SelectItem value="vertex">Vertex AI</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button variant="outline" size="icon"><Settings className="w-4 h-4" /></Button>
                                <Button variant="outline" className="gap-2"><Plus className="w-4 h-4" /> Voice</Button>
                            </div>
                            <Select defaultValue="adam">
                                <SelectTrigger>
                                    <SelectValue placeholder="Select voice" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="adam">Adam - Deep American</SelectItem>
                                    <SelectItem value="rachel">Rachel - Calm Female</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Size</Label>
                            <Select defaultValue="9:16">
                                <SelectTrigger>
                                    <SelectValue placeholder="Select size" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="9:16">Portrait (9:16)</SelectItem>
                                    <SelectItem value="16:9">Landscape (16:9)</SelectItem>
                                    <SelectItem value="1:1">Square (1:1)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </section>

                    {/* Transcript */}
                    <section className="space-y-2">
                        <div className="flex justify-between">
                            <Label>Transcript (Max 4000 characters)</Label>
                            <span className="text-xs text-muted-foreground">Total {transcript.length} characters</span>
                        </div>
                        <Textarea
                            placeholder="Enter your script here..."
                            className="min-h-[200px] resize-none"
                            value={transcript}
                            onChange={(e) => setTranscript(e.target.value)}
                            maxLength={4000}
                        />
                    </section>

                    <div className="flex justify-end">
                        <Button size="lg" onClick={handleContinue} disabled={!transcript || isGenerating}>
                            {isGenerating ? "Generating..." : "Continue"}
                        </Button>
                    </div>
                </div>
            </main>
        </div>
    )
}

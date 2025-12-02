"use client"

import { Navbar } from "@/components/Navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkles, MessageSquare, HelpCircle, Trophy, Twitter, Layout, Smartphone, Mic, FileText, FolderPlus, Search, Play, Trash2 } from "lucide-react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { useState, useEffect } from "react"
import { useToast } from "@/components/providers/toast-provider"

export default function Dashboard() {
    const [projects, setProjects] = useState<any[]>([])
    const { success } = useToast()

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const res = await fetch('/api/projects')
                if (res.ok) {
                    const data = await res.json()
                    setProjects(data)
                }
            } catch (error) {
                console.error("Failed to fetch projects:", error)
            }
        }
        fetchProjects()
    }, [])

    const handleClearVideos = async () => {
        if (window.confirm("Are you sure you want to delete all your videos? This action cannot be undone.")) {
            // In a real app, we would call DELETE /api/projects for each or a bulk delete endpoint
            // For now, let's just clear the state and maybe delete one by one if needed, 
            // but the user asked to "clear videos" which usually implies local cleanup.
            // Since we moved to server, we should probably implement a bulk delete or just warn them.

            // Let's implement client-side loop for now
            for (const project of projects) {
                await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
            }
            setProjects([])
            success("All videos cleared successfully")
        }
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Navbar />

            <main className="container mx-auto px-6 py-8 space-y-10">

                {/* Trending Templates */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <h2 className="text-lg font-semibold">Trending templates</h2>
                        <Sparkles className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Creepy Cartoon */}
                        <Link href="/create/ai-video-v2?style=creepy-cartoon">
                            <Card className="group hover:ring-2 hover:ring-primary transition-all cursor-pointer overflow-hidden border-0 bg-card/50">
                                <div className="aspect-[9/16] relative bg-muted">
                                    {/* Placeholder for image */}
                                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                                        <img src="/placeholder-creepy.jpg" alt="Creepy Cartoon" className="object-cover w-full h-full opacity-50 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <Badge className="absolute top-2 right-2 bg-green-500/20 text-green-500 hover:bg-green-500/30">Beta version</Badge>
                                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
                                        <h3 className="font-bold text-white">Creepy Cartoon</h3>
                                        <p className="text-xs text-gray-300">Create viral creepy cartoon video</p>
                                    </div>
                                </div>
                            </Card>
                        </Link>

                        {/* Roblox Rant */}
                        <Link href="/create/roblox-rant">
                            <Card className="group hover:ring-2 hover:ring-primary transition-all cursor-pointer overflow-hidden border-0 bg-card/50">
                                <div className="aspect-[9/16] relative bg-muted">
                                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                                        <img src="/placeholder-roblox.jpg" alt="Roblox Rant" className="object-cover w-full h-full opacity-50 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
                                        <h3 className="font-bold text-white">Roblox Rant</h3>
                                        <p className="text-xs text-gray-300">General roblox rant video</p>
                                    </div>
                                </div>
                            </Card>
                        </Link>

                        {/* Fake Text */}
                        <Link href="#">
                            <Card className="group hover:ring-2 hover:ring-primary transition-all cursor-pointer overflow-hidden border-0 bg-card/50">
                                <div className="aspect-[9/16] relative bg-muted">
                                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                                        <img src="/placeholder-faketext.jpg" alt="Fake Text" className="object-cover w-full h-full opacity-50 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
                                        <h3 className="font-bold text-white">Fake Text</h3>
                                        <p className="text-xs text-gray-300">Create fake text message story</p>
                                    </div>
                                </div>
                            </Card>
                        </Link>

                        {/* Quiz */}
                        <Link href="#">
                            <Card className="group hover:ring-2 hover:ring-primary transition-all cursor-pointer overflow-hidden border-0 bg-card/50">
                                <div className="aspect-[9/16] relative bg-muted">
                                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                                        <img src="/placeholder-quiz.jpg" alt="Quiz" className="object-cover w-full h-full opacity-50 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
                                        <h3 className="font-bold text-white">Quiz</h3>
                                        <p className="text-xs text-gray-300">Generate quiz questions video</p>
                                    </div>
                                </div>
                            </Card>
                        </Link>
                    </div>
                </section>

                {/* All Templates */}
                <section>
                    <h2 className="text-lg font-semibold mb-4">All templates</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <TemplateItem icon={<Sparkles className="text-pink-500" />} title="AI video V2" description="AI videos" badge="new" href="/create/ai-video-v2" />
                        <TemplateItem icon={<MessageSquare className="text-blue-500" />} title="Roblox rant" description="Roblox rant videos" badge="Trending" href="/create/roblox-rant" />
                        <TemplateItem icon={<MessageSquare className="text-green-500" />} title="Fake Text" description="Fake text message story" badge="best niche" href="#" />
                        <TemplateItem icon={<Sparkles className="text-purple-500" />} title="AI Video" description="Generate AI video" href="#" />
                        <TemplateItem icon={<HelpCircle className="text-yellow-500" />} title="Quiz" description="Quiz questions video" href="#" />
                        <TemplateItem icon={<FileText className="text-cyan-500" />} title="Add Captions" description="Auto captions video" href="#" />
                        <TemplateItem icon={<Sparkles className="text-orange-500" />} title="Brain Teasers" description="Brain teasers video" href="#" />
                        <TemplateItem icon={<Trophy className="text-red-500" />} title="Ranking" description="Best moments videos" href="#" />
                        <TemplateItem icon={<MessageSquare className="text-indigo-500" />} title="Reddit story" description="Reddit story videos" href="#" />
                        <TemplateItem icon={<Twitter className="text-blue-400" />} title="Twitter/X" description="Twitter/X thread video" href="#" />
                        <TemplateItem icon={<Layout className="text-teal-500" />} title="Split Screen" description="Split screen video" href="#" />
                        <TemplateItem icon={<Smartphone className="text-gray-500" />} title="Story" description="Story video" href="#" />
                        <TemplateItem icon={<Layout className="text-purple-400" />} title="Would You Rather" description="Would You Rather video" href="#" />
                    </div>
                </section>

                {/* Tools */}
                <section>
                    <h2 className="text-lg font-semibold mb-4">Tools</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ToolItem icon={<Mic className="text-green-500" />} title="AI Voice Generator" href="#" />
                        <ToolItem icon={<MessageSquare className="text-blue-500" />} title="Fake Text Screenshot" badge="free" href="#" />
                    </div>
                </section>

                {/* My Videos */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold">My Videos</h2>
                    </div>
                    <div className="flex items-center justify-between gap-4 mb-6">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input placeholder="Search" className="pl-9 bg-secondary/50 border-0" />
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" className="gap-2 text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/20" onClick={handleClearVideos}>
                                <Trash2 className="w-4 h-4" /> Clear Videos
                            </Button>
                        </div>
                    </div>

                    {projects.length === 0 ? (
                        <div className="rounded-lg border border-border/50 bg-card/30 min-h-[300px] flex flex-col items-center justify-center text-muted-foreground">
                            <div className="w-16 h-16 mb-4 opacity-20">
                                <FolderPlus className="w-full h-full" />
                            </div>
                            <p>No data</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {projects.map((project) => (
                                <div key={project.id} className="relative group">
                                    <Link href={`/editor/${project.id}`}>
                                        <Card className="group hover:ring-2 hover:ring-primary transition-all cursor-pointer overflow-hidden border-0 bg-card/50">
                                            <div className="aspect-[4/5] relative bg-muted">
                                                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                                                    {/* Placeholder thumbnail */}
                                                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                                                        <Play className="w-12 h-12 text-white/50" />
                                                    </div>
                                                </div>
                                                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
                                                    <h3 className="font-bold text-white truncate">{project.sentences?.[0]?.text || "Untitled Project"}</h3>
                                                    <p className="text-xs text-gray-300">{new Date(project.createdAt).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                        </Card>
                                    </Link>
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        className="absolute top-2 right-2 w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                        onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            if (confirm('Are you sure you want to delete this project?')) {
                                                const newProjects = projects.filter(p => p.id !== project.id)
                                                setProjects(newProjects)
                                                // In a real app, this would be an API call
                                                fetch('/api/projects', {
                                                    method: 'DELETE',
                                                    body: JSON.stringify({ id: project.id })
                                                }).catch(console.error)
                                            }
                                        }}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

            </main>
        </div>
    )
}

function TemplateItem({ icon, title, description, badge, href }: { icon: React.ReactNode, title: string, description: string, badge?: string, href: string }) {
    return (
        <Link href={href}>
            <div className="flex items-center gap-4 p-4 rounded-lg border border-border/40 bg-card/40 hover:bg-card/60 transition-colors cursor-pointer group">
                <div className="p-2 rounded-md bg-background/50 group-hover:scale-110 transition-transform">
                    {icon}
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm">{title}</h3>
                        {badge && (
                            <Badge variant="secondary" className={`text-[10px] h-5 px-1.5 ${badge === 'new' ? 'text-green-500 bg-green-500/10' : badge === 'Trending' ? 'text-cyan-500 bg-cyan-500/10' : 'text-yellow-500 bg-yellow-500/10'}`}>
                                {badge}
                            </Badge>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground">{description}</p>
                </div>
            </div>
        </Link>
    )
}

function ToolItem({ icon, title, badge, href }: { icon: React.ReactNode, title: string, badge?: string, href: string }) {
    return (
        <Link href={href}>
            <div className="flex items-center gap-4 p-4 rounded-lg border border-border/40 bg-card/40 hover:bg-card/60 transition-colors cursor-pointer">
                <div className="p-2 rounded-md bg-background/50">
                    {icon}
                </div>
                <div className="flex-1 flex items-center gap-2">
                    <h3 className="font-medium text-sm">{title}</h3>
                    {badge && (
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 text-green-500 bg-green-500/10">
                            {badge}
                        </Badge>
                    )}
                </div>
            </div>
        </Link>
    )
}

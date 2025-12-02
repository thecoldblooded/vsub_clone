"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Navbar } from "@/components/Navbar"
import { useToast } from "@/components/providers/toast-provider"
import { useConfirm } from "@/components/providers/confirm-provider"
import { Trash2, RefreshCw, FileVideo, Play, Search, Download, Loader2, Calendar, Clock, AlertCircle, CheckCircle2 } from "lucide-react"
import Link from "next/link"

interface Job {
    id: string
    type: string
    status: 'PENDING' | 'GENERATING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
    progress: number
    resultUrl?: string
    error?: string
    createdAt: string
    startedAt?: string
    finishedAt?: string
    metadata?: {
        originalName?: string
        size?: number
        backgroundVideo?: string
        backgroundThumbnail?: string
        projectId?: string
    }
}

export default function JobsPage() {
    const [jobs, setJobs] = useState<Job[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const { error: showError, success } = useToast()
    const { confirm } = useConfirm()

    const fetchJobs = async () => {
        try {
            const res = await fetch('/api/jobs')
            if (res.ok) {
                const data = await res.json()
                setJobs(data.sort((a: Job, b: Job) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
                return data
            }
        } catch (error) {
            console.error("Failed to fetch jobs:", error)
        } finally {
            setLoading(false)
        }
        return null
    }

    useEffect(() => {
        let timeoutId: NodeJS.Timeout

        const runLoop = async () => {
            const data = await fetchJobs()

            let interval = 10000 // Default slow poll

            if (data) {
                const hasActiveJobs = data.some((j: Job) => j.status === 'GENERATING' || j.status === 'PROCESSING')
                if (hasActiveJobs) {
                    interval = 3000 // Fast poll if active
                }
            }

            timeoutId = setTimeout(runLoop, interval)
        }

        runLoop()

        return () => clearTimeout(timeoutId)
    }, [])

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'COMPLETED': return <CheckCircle2 className="w-3.5 h-3.5" />
            case 'FAILED': return <AlertCircle className="w-3.5 h-3.5" />
            case 'PROCESSING': return <Loader2 className="w-3.5 h-3.5 animate-spin" />
            case 'GENERATING': return <Loader2 className="w-3.5 h-3.5 animate-spin" />
            default: return <Clock className="w-3.5 h-3.5" />
        }
    }

    const deleteJob = async (id: string) => {
        const confirmed = await confirm({
            title: "Delete Job",
            description: "Are you sure you want to delete this job? This action cannot be undone.",
            confirmText: "Delete",
            cancelText: "Cancel",
            variant: "destructive"
        })

        if (!confirmed) return

        try {
            const res = await fetch(`/api/jobs/${id}`, { method: 'DELETE' })
            if (res.ok) {
                setJobs(jobs.filter(j => j.id !== id))
                success("Job deleted successfully")
            } else {
                showError("Failed to delete job")
            }
        } catch (error) {
            console.error("Delete failed:", error)
            showError("Failed to delete job")
        }
    }

    const deleteAllJobs = async () => {
        const confirmed = await confirm({
            title: "Delete All Jobs",
            description: "Are you sure you want to delete ALL jobs? This will permanently delete all video files and cannot be undone.",
            confirmText: "Delete All",
            cancelText: "Cancel",
            variant: "destructive"
        })

        if (!confirmed) return

        try {
            const res = await fetch('/api/jobs', { method: 'DELETE' })
            if (res.ok) {
                setJobs([])
                success("All jobs deleted successfully")
            } else {
                showError("Failed to delete jobs")
            }
        } catch (error) {
            console.error("Delete all failed:", error)
            showError("Failed to delete jobs")
        }
    }

    const filteredJobs = jobs.filter(job =>
        (job.metadata?.originalName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.id.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            <Navbar />

            <div className="container mx-auto px-4 py-12 max-w-6xl flex-1">
                <div className="flex flex-col gap-6 mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight mb-2">My Videos</h1>
                            <p className="text-muted-foreground">Manage and download your exported videos.</p>
                        </div>
                        <div className="flex gap-2">
                            {jobs.length > 0 && (
                                <Button variant="destructive" onClick={deleteAllJobs} disabled={loading} className="gap-2">
                                    <Trash2 className="w-4 h-4" />
                                    Delete All
                                </Button>
                            )}
                            <Button variant="outline" onClick={fetchJobs} disabled={loading} className="gap-2">
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                        </div>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search videos..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-10 bg-card/50 border-border/40"
                        />
                    </div>
                </div>

                {loading && jobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-4">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p>Loading videos...</p>
                    </div>
                ) : filteredJobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-4">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                            <FileVideo className="w-8 h-8 text-primary" />
                        </div>
                        <h3 className="text-lg font-medium text-foreground">No videos found</h3>
                        <p className="max-w-sm text-center">
                            {searchQuery ? "No videos match your search." : "You haven't exported any videos yet. Create a project and export it to see it here."}
                        </p>
                        {!searchQuery && (
                            <Button asChild className="mt-4">
                                <Link href="/create/roblox-rant">Create New Video</Link>
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredJobs.map((job) => (
                            <Card
                                key={job.id}
                                className="group overflow-hidden border-border/40 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-colors relative"
                                onMouseEnter={(e) => {
                                    const videos = e.currentTarget.querySelectorAll('video');
                                    videos.forEach(v => v.play().catch(() => { }));
                                }}
                                onMouseLeave={(e) => {
                                    const videos = e.currentTarget.querySelectorAll('video');
                                    videos.forEach(v => {
                                        v.pause();
                                        v.currentTime = 0;
                                    });
                                }}
                            >
                                <div className="aspect-[9/16] bg-gray-900 relative overflow-hidden">
                                    {/* Background Layer */}
                                    <div className="absolute inset-0 bg-gray-900">
                                        {/* Fallback Image (Always present at bottom) */}
                                        <img
                                            src="/placeholder-roblox.jpg"
                                            className="absolute inset-0 w-full h-full object-cover opacity-100"
                                            alt="Background Fallback"
                                        />

                                        {/* Thumbnail or Video Layer */}
                                        {job.metadata?.backgroundThumbnail ? (
                                            <img
                                                src={job.metadata.backgroundThumbnail}
                                                className="absolute inset-0 w-full h-full object-cover opacity-80 z-10 relative"
                                                alt="Background"
                                                onError={(e) => e.currentTarget.style.display = 'none'}
                                            />
                                        ) : job.metadata?.backgroundVideo && (
                                            <video
                                                src={job.metadata.backgroundVideo}
                                                className="absolute inset-0 w-full h-full object-cover opacity-80 z-10 relative"
                                                muted
                                                playsInline
                                                loop
                                                onError={(e) => e.currentTarget.style.display = 'none'}
                                            />
                                        )}
                                    </div>

                                    {job.status === 'COMPLETED' && job.resultUrl ? (
                                        <>
                                            <video
                                                src={job.resultUrl}
                                                className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity relative z-10"
                                                muted
                                                loop
                                                playsInline
                                                preload="auto"
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:opacity-0 transition-opacity z-20">
                                                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                                    <Play className="w-6 h-6 text-white fill-white" />
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2 p-4 text-center bg-black/40 backdrop-blur-sm z-20">
                                            {getStatusIcon(job.status)}
                                            <span className="text-sm font-medium text-white shadow-black drop-shadow-md">{job.status}</span>
                                            {(job.status === 'PROCESSING' || job.status === 'GENERATING') && (
                                                <div className="w-full max-w-[100px] h-1 bg-white/20 rounded-full overflow-hidden mt-2">
                                                    <div
                                                        className="h-full bg-primary transition-all duration-300"
                                                        style={{ width: `${job.progress}%` }}
                                                    />
                                                </div>
                                            )}
                                            {job.error && <span className="text-xs text-red-400 bg-black/50 px-2 py-1 rounded">{job.error}</span>}
                                        </div>
                                    )}

                                    {/* Overlay Actions */}
                                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-30">
                                        {job.status === 'COMPLETED' && job.resultUrl && (
                                            <Button asChild size="icon" variant="secondary" className="h-8 w-8 rounded-md shadow-lg bg-white/90 hover:bg-white text-black">
                                                <a href={`/api/jobs/${job.id}/download`} download onClick={e => e.stopPropagation()}>
                                                    <Download className="w-4 h-4" />
                                                </a>
                                            </Button>
                                        )}
                                        <Button
                                            size="icon"
                                            variant="destructive"
                                            className="h-8 w-8 rounded-md shadow-lg"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                deleteJob(job.id)
                                            }}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>

                                    {/* Bottom Gradient & Info */}
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 pt-12 pointer-events-none z-20">
                                        <h3 className="text-white font-medium truncate mb-0.5" title={job.metadata?.originalName}>
                                            {job.metadata?.originalName || "Untitled Video"}
                                        </h3>
                                        <div className="flex items-center justify-between text-white/70 text-xs">
                                            <span>{new Date(job.createdAt).toLocaleDateString()}</span>
                                            {job.status === 'COMPLETED' && (
                                                <Badge variant="outline" className="border-white/20 text-white/90 bg-white/10 h-5 px-1.5">
                                                    Ready
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

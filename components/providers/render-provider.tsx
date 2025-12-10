"use client"

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { Project, CaptionSettings } from '@/types'
import { renderVideo } from '@/lib/render-service'
import { useToast } from '@/components/providers/toast-provider'

interface RenderContextType {
    isRendering: boolean
    progress: number
    status: string
    phase: string // 'preloading' | 'generating' | 'zipping' | 'uploading'
    startRender: (project: Project, captionSettings: CaptionSettings, width?: number, height?: number) => void
    cancelRender: () => void // Not fully implemented in service yet, but good for interface
}

const RenderContext = createContext<RenderContextType | undefined>(undefined)

export function RenderProvider({ children }: { children: ReactNode }) {
    const [isRendering, setIsRendering] = useState(false)
    const [progress, setProgress] = useState(0)
    const [status, setStatus] = useState("")
    const [phase, setPhase] = useState("")
    const { success, error: showError } = useToast()

    const startRender = useCallback((project: Project, captionSettings: CaptionSettings, width: number = 1080, height: number = 1920) => {
        if (isRendering) return

        setIsRendering(true)
        setProgress(0)
        setStatus("Starting render...")
        setPhase('preloading')

        // Determine background video URL
        // In the original component, it was implicit from videoRef.
        // Here we need it explicitly.
        // The project object usually has it if it was saved, or we pass it? 
        // The Project interface has `backgroundVideo`.
        const bgUrl = project.backgroundVideo || '/placeholder.mp4' // Fallback needed?

        renderVideo({
            project,
            captionSettings,
            width,
            height,
            backgroundVideoUrl: bgUrl,
            userId: 'user-1', // TODO: Auth
            onProgress: (p, s, ph) => {
                setProgress(p)
                setStatus(s)
                setPhase(ph)
            },
            onComplete: (url, jobId) => {
                setIsRendering(false)
                setProgress(100)
                setStatus("Render Complete!")
                success("Video render completed successfully!")
                // Optionally redirect or show download link
            },
            onError: (err) => {
                setIsRendering(false)
                console.error(err)
                showError("Render failed. Check console for details.")
                setStatus("Error")
            }
        })
    }, [isRendering, success, showError])

    const cancelRender = useCallback(() => {
        // TODO: Implement cancellation signal
        setIsRendering(false)
        setStatus("Cancelled")
    }, [])

    return (
        <RenderContext.Provider value={{ isRendering, progress, status, phase, startRender, cancelRender }}>
            {children}
            {isRendering && (
                <RenderStatusToast progress={progress} status={status} />
            )}
        </RenderContext.Provider>
    )
}

export function useRender() {
    const context = useContext(RenderContext)
    if (!context) {
        throw new Error("useRender must be used within a RenderProvider")
    }
    return context
}

// Internal Toast Component (Active only during render)
import { Loader2 } from 'lucide-react'

function RenderStatusToast({ progress, status }: { progress: number, status: string }) {
    return (
        <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-zinc-900 border border-zinc-800 text-white px-4 py-3 rounded-lg shadow-2xl flex items-center gap-4 min-w-[300px]">
                <div className="relative flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                    {/* Optional: Add circular progress SVG here for more detail */}
                </div>
                <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-sm">Rendering Video</span>
                        <span className="text-xs text-zinc-400">{Math.round(progress)}%</span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 transition-all duration-300 ease-out"
                            style={{ width: `${Math.max(2, progress)}%` }}
                        />
                    </div>
                    <p className="text-xs text-zinc-500 mt-1 truncate max-w-[200px]">{status}</p>
                </div>
            </div>
        </div>
    )
}

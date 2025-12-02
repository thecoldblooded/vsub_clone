import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ToastProps {
    id: string
    title?: string
    description?: string
    type?: "success" | "error" | "info" | "warning"
    onClose: () => void
}

export function Toast({ id, title, description, type = "info", onClose }: ToastProps) {
    const bgColor = {
        success: "bg-green-600 border-green-700",
        error: "bg-red-600 border-red-700",
        info: "bg-blue-600 border-blue-700",
        warning: "bg-yellow-600 border-yellow-700"
    }[type]

    return (
        <div
            className={cn(
                "pointer-events-auto w-full max-w-sm rounded-lg border-2 p-4 shadow-2xl transition-all animate-in slide-in-from-bottom-5",
                bgColor
            )}
        >
            <div className="flex gap-3">
                <div className="flex-1">
                    {title && (
                        <div className="font-semibold text-sm mb-1 text-white">
                            {title}
                        </div>
                    )}
                    {description && (
                        <div className="text-sm text-white/90">
                            {description}
                        </div>
                    )}
                </div>
                <button
                    onClick={onClose}
                    className="text-white/80 hover:text-white transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    )
}

interface ToastContainerProps {
    toasts: ToastProps[]
}

export function ToastContainer({ toasts }: ToastContainerProps) {
    return (
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
            {toasts.map((toast) => (
                <Toast key={toast.id} {...toast} />
            ))}
        </div>
    )
}

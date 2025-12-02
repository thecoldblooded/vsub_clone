"use client"

import React, { createContext, useContext, useState, useCallback } from "react"
import { ToastContainer } from "@/components/ui/toast"

interface Toast {
    id: string
    title?: string
    description?: string
    type?: "success" | "error" | "info" | "warning"
    duration?: number
    onClose: () => void
}

interface ToastContextType {
    toast: (options: Omit<Toast, "id" | "onClose">) => void
    success: (message: string, title?: string) => void
    error: (message: string, title?: string) => void
    info: (message: string, title?: string) => void
    warning: (message: string, title?: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
    }, [])

    const toast = useCallback(
        ({ title, description, type = "info", duration = 5000 }: Omit<Toast, "id" | "onClose">) => {
            const id = Math.random().toString(36).substr(2, 9)

            const newToast: Toast = {
                id,
                title,
                description,
                type,
                onClose: () => removeToast(id)
            }

            setToasts((prev) => [...prev, newToast])

            if (duration > 0) {
                setTimeout(() => removeToast(id), duration)
            }
        },
        [removeToast]
    )

    const success = useCallback(
        (message: string, title?: string) => {
            toast({ description: message, title: title || "Success", type: "success" })
        },
        [toast]
    )

    const error = useCallback(
        (message: string, title?: string) => {
            toast({ description: message, title: title || "Error", type: "error" })
        },
        [toast]
    )

    const info = useCallback(
        (message: string, title?: string) => {
            toast({ description: message, title: title || "Info", type: "info" })
        },
        [toast]
    )

    const warning = useCallback(
        (message: string, title?: string) => {
            toast({ description: message, title: title || "Warning", type: "warning" })
        },
        [toast]
    )

    return (
        <ToastContext.Provider value={{ toast, success, error, info, warning }}>
            {children}
            <ToastContainer toasts={toasts} />
        </ToastContext.Provider>
    )
}

export function useToast() {
    const context = useContext(ToastContext)
    if (!context) {
        throw new Error("useToast must be used within ToastProvider")
    }
    return context
}

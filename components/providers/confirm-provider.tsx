"use client"

import React, { createContext, useContext, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

interface ConfirmOptions {
    title?: string
    description: string
    confirmText?: string
    cancelText?: string
    variant?: "default" | "destructive"
}

interface ConfirmContextType {
    confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false)
    const [options, setOptions] = useState<ConfirmOptions>({
        description: "",
        confirmText: "OK",
        cancelText: "Cancel",
        variant: "default"
    })
    const [resolveCallback, setResolveCallback] = useState<((value: boolean) => void) | null>(null)

    const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setOptions({
                title: opts.title || "Confirm",
                description: opts.description,
                confirmText: opts.confirmText || "OK",
                cancelText: opts.cancelText || "Cancel",
                variant: opts.variant || "default"
            })
            setResolveCallback(() => resolve)
            setIsOpen(true)
        })
    }, [])

    const handleConfirm = () => {
        if (resolveCallback) {
            resolveCallback(true)
        }
        setIsOpen(false)
    }

    const handleCancel = () => {
        if (resolveCallback) {
            resolveCallback(false)
        }
        setIsOpen(false)
    }

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{options.title}</DialogTitle>
                        <DialogDescription className="text-base">
                            {options.description}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleCancel}
                        >
                            {options.cancelText}
                        </Button>
                        <Button
                            type="button"
                            variant={options.variant === "destructive" ? "destructive" : "default"}
                            onClick={handleConfirm}
                        >
                            {options.confirmText}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </ConfirmContext.Provider>
    )
}

export function useConfirm() {
    const context = useContext(ConfirmContext)
    if (!context) {
        throw new Error("useConfirm must be used within ConfirmProvider")
    }
    return context
}

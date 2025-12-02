"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Bell, MessageCircle, User, LogOut, Briefcase, LogIn } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export function Navbar() {
    const [isLoggedIn, setIsLoggedIn] = useState(false)
    const router = useRouter()

    useEffect(() => {
        // Check for auth cookie
        const hasAuth = document.cookie.includes("google_auth_status=true")
        setIsLoggedIn(hasAuth)
    }, [])

    const handleSignOut = async () => {
        try {
            await fetch('/api/auth/signout', { method: 'POST' })
            setIsLoggedIn(false)
            router.refresh()
            router.push('/')
        } catch (error) {
            console.error("Failed to sign out", error)
        }
    }

    return (
        <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/20 backdrop-blur-xl supports-[backdrop-filter]:bg-black/20">
            <div className="flex items-center justify-between px-6 h-16 max-w-7xl mx-auto">
                <div className="flex items-center gap-8">
                    <Link href="/" className="group relative flex items-center gap-2">
                        <div className="absolute -inset-2 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg opacity-0 group-hover:opacity-20 blur transition-opacity duration-500" />
                        <span className="relative text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500 hover:from-blue-400 hover:via-cyan-400 hover:to-teal-400 transition-all duration-300">
                            Vsub
                        </span>
                    </Link>
                </div>
                <div className="flex items-center gap-4">
                    {isLoggedIn ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Avatar className="cursor-pointer h-9 w-9 ring-2 ring-white/10 hover:ring-primary/50 transition-all duration-300 hover:scale-105">
                                    <AvatarImage src="https://github.com/shadcn.png" />
                                    <AvatarFallback className="bg-gradient-to-br from-pink-500 to-violet-600 text-white font-bold">CN</AvatarFallback>
                                </Avatar>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 bg-black/90 backdrop-blur-xl border-white/10 text-white">
                                <DropdownMenuLabel className="text-white/60">My Account</DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-white/10" />
                                <DropdownMenuItem className="cursor-pointer hover:bg-white/10 focus:bg-white/10 focus:text-white transition-colors">
                                    <User className="mr-2 h-4 w-4 text-violet-400" />
                                    <span>Profile</span>
                                </DropdownMenuItem>
                                <Link href="/jobs">
                                    <DropdownMenuItem className="cursor-pointer hover:bg-white/10 focus:bg-white/10 focus:text-white transition-colors">
                                        <Briefcase className="mr-2 h-4 w-4 text-pink-400" />
                                        <span>My Jobs</span>
                                    </DropdownMenuItem>
                                </Link>
                                <DropdownMenuSeparator className="bg-white/10" />
                                <DropdownMenuItem className="cursor-pointer text-red-400 focus:text-red-300 focus:bg-red-500/10 hover:bg-red-500/10 hover:text-red-300 transition-colors" onClick={handleSignOut}>
                                    <LogOut className="mr-2 h-4 w-4" />
                                    <span>Log out</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <Link href="/api/auth/signin">
                            <Button className="gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 backdrop-blur-sm transition-all duration-300 hover:scale-105 active:scale-95 group">
                                <LogIn className="w-4 h-4 text-violet-400 group-hover:text-pink-400 transition-colors" />
                                <span className="font-medium">Sign In</span>
                            </Button>
                        </Link>
                    )}
                </div>
            </div>
        </nav>
    )
}

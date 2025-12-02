import { create } from 'zustand'

interface Project {
    id: string
    name: string
    type: 'ai-video-v2' | 'roblox-rant' | 'fake-text'
    createdAt: Date
    status: 'draft' | 'processing' | 'completed'
    thumbnail?: string
}

interface AppState {
    projects: Project[]
    addProject: (project: Project) => void
    removeProject: (id: string) => void
    currentProject: Project | null
    setCurrentProject: (project: Project | null) => void
}

export const useAppStore = create<AppState>((set) => ({
    projects: [],
    addProject: (project) => set((state) => ({ projects: [project, ...state.projects] })),
    removeProject: (id) => set((state) => ({ projects: state.projects.filter((p) => p.id !== id) })),
    currentProject: null,
    setCurrentProject: (project) => set({ currentProject: project }),
}))

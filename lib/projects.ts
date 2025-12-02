import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const PROJECTS_FILE = path.join(process.cwd(), 'data', 'projects.json')
const DATA_DIR = path.join(process.cwd(), 'data')

export interface Project {
    id: string
    userId: string
    type: string
    sentences: any[]
    backgroundVideo?: string
    captionSettings?: any
    createdAt: string
    updatedAt: string
    thumbnail?: string
    backgroundThumbnail?: string
    status: 'draft' | 'processing' | 'completed'
}

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
}

// Ensure projects file exists
if (!fs.existsSync(PROJECTS_FILE)) {
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify([]))
}

export function getProjects(): Project[] {
    try {
        const data = fs.readFileSync(PROJECTS_FILE, 'utf-8')
        return JSON.parse(data)
    } catch (e) {
        console.error("Failed to read projects file:", e)
        return []
    }
}

export function saveProjects(projects: Project[]) {
    try {
        fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2))
    } catch (e) {
        console.error("Failed to write projects file:", e)
    }
}

export function createProject(data: Partial<Project>): Project {
    const projects = getProjects()
    const newProject: Project = {
        id: data.id || uuidv4(),
        userId: data.userId || 'anonymous',
        type: data.type || 'unknown',
        sentences: data.sentences || [],
        backgroundVideo: data.backgroundVideo,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'draft',
        ...data
    }
    projects.unshift(newProject)
    saveProjects(projects)
    return newProject
}

export function updateProject(id: string, updates: Partial<Project>): Project | null {
    const projects = getProjects()
    const index = projects.findIndex(p => p.id === id)
    if (index !== -1) {
        projects[index] = {
            ...projects[index],
            ...updates,
            updatedAt: new Date().toISOString()
        }
        saveProjects(projects)
        return projects[index]
    }
    return null
}

export function getProject(id: string): Project | undefined {
    const projects = getProjects()
    return projects.find(p => p.id === id)
}

export function deleteProject(id: string): boolean {
    let projects = getProjects()
    const initialLength = projects.length
    projects = projects.filter(p => p.id !== id)
    if (projects.length !== initialLength) {
        saveProjects(projects)
        return true
    }
    return false
}

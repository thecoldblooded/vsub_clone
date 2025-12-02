import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const JOBS_FILE = path.join(process.cwd(), 'data', 'jobs.json')
const DATA_DIR = path.join(process.cwd(), 'data')

export interface Job {
    id: string
    userId: string
    type: 'VIDEO_EXPORT'
    status: 'PENDING' | 'GENERATING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
    progress: number
    resultUrl?: string
    error?: string
    createdAt: string
    updatedAt: string
    startedAt?: string
    finishedAt?: string
    metadata?: any
}

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
}

// Ensure jobs file exists
if (!fs.existsSync(JOBS_FILE)) {
    fs.writeFileSync(JOBS_FILE, JSON.stringify([]))
}

export function getJobs(): Job[] {
    try {
        const data = fs.readFileSync(JOBS_FILE, 'utf-8')
        return JSON.parse(data)
    } catch (e) {
        console.error("Failed to read jobs file:", e)
        return []
    }
}

export function saveJobs(jobs: Job[]) {
    try {
        fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2))
    } catch (e) {
        console.error("Failed to write jobs file:", e)
    }
}

export function createJob(type: 'VIDEO_EXPORT', userId: string, metadata: any = {}): Job {
    const jobs = getJobs()
    const newJob: Job = {
        id: uuidv4(),
        userId,
        type,
        status: 'PENDING',
        progress: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata
    }
    jobs.unshift(newJob) // Add to beginning
    saveJobs(jobs)
    return newJob
}

export function updateJob(id: string, updates: Partial<Job>) {
    const jobs = getJobs()
    const index = jobs.findIndex(j => j.id === id)
    if (index !== -1) {
        jobs[index] = {
            ...jobs[index],
            ...updates,
            updatedAt: new Date().toISOString()
        }
        saveJobs(jobs)
        return jobs[index]
    }
    return null
}

export function getJob(id: string): Job | undefined {
    const jobs = getJobs()
    return jobs.find(j => j.id === id)
}

export function deleteJob(id: string): boolean {
    const jobs = getJobs()
    const initialLength = jobs.length
    const newJobs = jobs.filter(j => j.id !== id)

    if (newJobs.length !== initialLength) {
        saveJobs(newJobs)
        return true
    }
    return false
}

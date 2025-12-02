import { NextRequest, NextResponse } from 'next/server'
import { getProjects, createProject } from '@/lib/projects'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    let projects = getProjects()
    if (userId) {
        projects = projects.filter(p => p.userId === userId)
    }

    // Sort by updatedAt desc
    projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

    return NextResponse.json(projects)
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const project = createProject(body)
        return NextResponse.json(project)
    } catch (error) {
        console.error("Failed to create project:", error)
        return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
    }
}


export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json()
        const { id } = body

        if (!id) {
            return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
        }

        const { deleteProject } = await import('@/lib/projects')
        const success = deleteProject(id)

        if (success) {
            return NextResponse.json({ success: true })
        } else {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 })
        }
    } catch (error) {
        console.error("Failed to delete project:", error)
        return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
    }
}

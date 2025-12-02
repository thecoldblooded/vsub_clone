import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '')}`
        const uploadDir = path.join(process.cwd(), 'public', 'uploads')

        // Ensure upload directory exists
        await fs.mkdir(uploadDir, { recursive: true })

        const filepath = path.join(uploadDir, filename)
        await fs.writeFile(filepath, buffer)

        return NextResponse.json({
            url: `/uploads/${filename}`,
            filename: filename
        })

    } catch (error) {
        console.error('Upload error:', error)
        return NextResponse.json(
            { error: 'Upload failed' },
            { status: 500 }
        )
    }
}

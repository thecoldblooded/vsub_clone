import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    try {
        const url = request.nextUrl.searchParams.get('url')

        if (!url) {
            return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 })
        }

        // Fetch the external resource
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        })

        if (!response.ok) {
            return NextResponse.json({ error: 'Failed to fetch resource' }, { status: response.status })
        }

        // Get the content type and body
        const contentType = response.headers.get('content-type') || 'application/octet-stream'
        const arrayBuffer = await response.arrayBuffer()

        // Return the proxied resource with appropriate headers
        return new NextResponse(arrayBuffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=31536000, immutable'
            }
        })
    } catch (error) {
        console.error('Proxy error:', error)
        return NextResponse.json({ error: 'Proxy request failed' }, { status: 500 })
    }
}

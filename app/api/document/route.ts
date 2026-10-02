import mediaMap from '@/lib/media-map.json'
import readingMap from '@/lib/pdf-reading-map.json'
import { mediaBaseUrl } from '@/lib/site'

// Only serve PDFs already registered in the portfolio. Range requests let the
// reader open a page without first downloading a whole scanned publication.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const source = url.searchParams.get('src') ?? ''
  const originalKey = (mediaMap as Record<string, string>)[source]
  if (!originalKey || !originalKey.toLowerCase().endsWith('.pdf')) {
    return new Response('Document not found', { status: 404 })
  }
  const downloading = url.searchParams.get('download') === '1'
  const key = downloading ? originalKey : (readingMap as Record<string, string>)[source] ?? originalKey

  const headers = new Headers()
  const range = request.headers.get('range')
  if (range) headers.set('Range', range)
  const upstream = await fetch(`${mediaBaseUrl}/${key.split('/').map(encodeURIComponent).join('/')}`, {
    headers,
    cache: 'no-store',
    signal: request.signal,
  })
  if (!upstream.ok) {
    return new Response('The document could not be loaded. Please try again.', { status: upstream.status })
  }
  const responseHeaders = new Headers({
    'Content-Type': 'application/pdf',
    'Cache-Control': 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  })
  for (const name of ['Content-Length', 'Content-Range', 'Accept-Ranges', 'ETag']) {
    const value = upstream.headers.get(name)
    if (value) responseHeaders.set(name, value)
  }
  if (downloading) {
    responseHeaders.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(key.split('/').at(-1) ?? 'document.pdf')}`)
  }
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders })
}

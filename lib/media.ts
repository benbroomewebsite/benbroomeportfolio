import mediaMap from './media-map.json'

export function mediaHref(href: string) {
  const mediaBase = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL || 'https://pub-77bd6b0eb2e9483f9b0201fc3bb527e7.r2.dev').replace(/\/$/, '')
  const objectKey = (mediaMap as Record<string, string>)[href]
  return objectKey ? `${mediaBase}/${objectKey.split('/').map(encodeURIComponent).join('/')}` : href
}

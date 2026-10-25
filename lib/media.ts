import mediaMap from './media-map.json'

export function mediaHref(href: string) {
  const mediaBase = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL || 'https://media.benbroome.co.uk').replace(/\/$/, '')
  const objectKey = (mediaMap as Record<string, string>)[href]
  return objectKey ? `${mediaBase}/${objectKey.split('/').map(encodeURIComponent).join('/')}` : href
}

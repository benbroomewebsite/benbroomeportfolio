export const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://benbroomeportfolio.vercel.app')
export const siteName = 'Ben Broome'
export const siteDescription = 'Selected exhibitions, writing, performances, and research by curator Ben Broome.'
export const absoluteUrl = (path: string) => new URL(path, siteUrl).toString()
export const mediaBaseUrl = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL || 'https://pub-77bd6b0eb2e9483f9b0201fc3bb527e7.r2.dev').replace(/\/$/, '')

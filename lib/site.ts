// Search engines and sharing metadata use the public domain, including on previews.
export const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://benbroome.co.uk')
export const siteName = 'Ben Broome'
export const siteDescription = 'Selected exhibitions, writing, performances, and research by curator Ben Broome.'
export const absoluteUrl = (path: string) => new URL(path, siteUrl).toString()
export const mediaBaseUrl = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL || 'https://media.benbroome.co.uk').replace(/\/$/, '')

import { readFileSync } from 'node:fs'

const legacyRedirects = JSON.parse(readFileSync(new URL('./lib/legacy-redirects.json', import.meta.url), 'utf8'))

/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return Object.entries(legacyRedirects).map(([source, destination]) => ({ source, destination, permanent: true }))
  },
  // The editor's GitHub sign-in runs on 127.0.0.1 during local setup.
  allowedDevOrigins: ['127.0.0.1'],
  images: {
    unoptimized: true,
  },
}

export default nextConfig

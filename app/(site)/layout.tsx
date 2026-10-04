import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { FontTrial } from '@/components/font-trial'
import { siteDescription, siteName, siteUrl } from '@/lib/site'
import '../globals.css'

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: { default: 'Ben Broome — Curator, Writer, Organiser', template: '%s — Ben Broome' },
  description: siteDescription,
  alternates: { canonical: '/' },
  openGraph: { type: 'website', url: '/', siteName, title: 'Ben Broome — Curator, Writer, Organiser', description: siteDescription, images: ['/opengraph-image'] },
  twitter: { card: 'summary_large_image', title: 'Ben Broome — Curator, Writer, Organiser', description: siteDescription, images: ['/opengraph-image'] },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const personSchema = { '@context': 'https://schema.org', '@type': 'Person', name: 'Ben Broome', url: siteUrl.toString(), email: 'mailto:ben@drawingablank.com', jobTitle: 'Curator, writer and organiser', sameAs: ['https://www.instagram.com/drabl'] }
  return (
    <html lang="en">
      <body className="antialiased">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }} />
        <FontTrial />
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}

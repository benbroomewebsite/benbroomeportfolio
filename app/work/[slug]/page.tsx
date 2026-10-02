import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { Portfolio } from '@/components/portfolio'
import mediaMap from '@/lib/media-map.json'
import { absoluteUrl, mediaBaseUrl } from '@/lib/site'
import { getWorkByAnySlug, works } from '@/lib/works'

const mediaUrl = (path: string) => {
  const key = (mediaMap as Record<string, string>)[path]
  return key ? `${mediaBaseUrl}/${key.split('/').map(encodeURIComponent).join('/')}` : absoluteUrl(path)
}

export function generateStaticParams() {
  return works.flatMap((work) => [{ slug: work.slug }, ...(work.legacySlug ? [{ slug: work.legacySlug }] : [])])
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const work = getWorkByAnySlug(slug)
  if (!work) return { title: 'Work not found' }
  const description = [work.type, work.publication, work.date].filter(Boolean).join(' · ')
  const url = `/work/${work.slug}`
  return {
    title: work.title, description, alternates: { canonical: url },
    openGraph: { type: 'article', title: work.title, description, url, images: work.images[0] ? [mediaUrl(work.images[0].src)] : ['/opengraph-image'] },
    twitter: { card: 'summary_large_image', title: work.title, description, images: work.images[0] ? [mediaUrl(work.images[0].src)] : ['/opengraph-image'] },
  }
}

export default async function WorkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const work = getWorkByAnySlug(slug)
  if (!work) notFound()
  if (slug !== work.slug) permanentRedirect(`/work/${work.slug}`)
  const schema = {
    '@context': 'https://schema.org',
    '@type': work.category === 'Selected Writing' ? 'Article' : 'CreativeWork',
    name: work.title, url: absoluteUrl(`/work/${work.slug}`),
    creator: { '@type': 'Person', name: 'Ben Broome', url: absoluteUrl('/') },
    dateCreated: work.year ? String(work.year) : undefined,
    description: work.description || [work.type, work.publication, work.date].filter(Boolean).join(' · '),
    image: work.images.map((image) => mediaUrl(image.src)),
  }
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    <Portfolio selectedSlug={work.slug} />
  </>
}

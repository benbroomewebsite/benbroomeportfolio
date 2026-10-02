import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/site'
import { works } from '@/lib/works'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: absoluteUrl('/'), changeFrequency: 'monthly', priority: 1 },
    { url: absoluteUrl('/bio'), changeFrequency: 'yearly', priority: 0.6 },
    ...works.map((work) => ({ url: absoluteUrl(`/work/${work.slug}`), changeFrequency: 'yearly' as const, priority: 0.7 })),
  ]
}

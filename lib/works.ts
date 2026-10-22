import data from './generated/works.json'
import site from './generated/site.json'
import mediaMap from './media-map.json'
import type { ImageLayout } from './gallery-layout'

export type WorkCategory = 'Exhibition' | 'Selected Writing' | 'Performance' | 'Talk' | 'Artist Grant' | 'Press'

export type WorkImage = {
  src: string
  alt: string
  originalName?: string
  width?: number
  height?: number
  group?: string
  layout?: ImageLayout
}

export type WorkVideo = { src: string; label: string; group?: string }

export type WorkFile = {
  label: string
  href: string
}

// A document is read on the project page, or listed with the links (a press release).
export type WorkDocument = WorkFile & { display: 'inline' | 'link' }

export type Work = {
  slug: string
  legacySlug?: string
  title: string
  indexTitle: string
  type: string
  publication: string
  date: string
  year: number
  description: string
  images: WorkImage[]
  imageOrder: 'random' | 'manual'
  videos?: WorkVideo[]
  sortDate?: string
  files: WorkDocument[]
  links: WorkFile[]
  externalHref: string | null
  featuredImage: string
  order: number
  category: WorkCategory
  alsoInWriting: boolean
}

// One entry per file in content/works, edited at /keystatic. `date` is YYYY,
// YYYY-MM or YYYY-MM-DD depending on how precisely the date is known.
type ContentWork = {
  slug: string
  title: string
  indexTitle?: string
  category: string
  alsoInWriting?: boolean
  type?: string
  publication?: string
  date?: string
  description?: string
  externalHref?: string | null
  links?: WorkFile[]
  files?: Array<{ label?: string; href?: string; upload?: string | null; display?: 'inline' | 'link' }>
  featuredImage?: string
  imageOrder?: 'random' | 'manual'
  // `upload` is a file added through the editor; `src` names one already in the media bucket.
  images?: Array<{ src?: string; upload?: string | null; alt?: string; group?: string; width?: number | null; height?: number | null; originalName?: string; layout?: ImageLayout }>
  videos?: Array<{ src: string; label?: string; group?: string }>
  legacySlug?: string
  order?: number | null
}

// Edited at /keystatic under Bio and contact.
export const aboutParagraphs = site.bio.split(/\n\n+/).map((paragraph) => paragraph.trim()).filter(Boolean)
export const contact = { email: site.email, instagram: site.instagram }
export const portrait = site.portrait ? { src: site.portrait, alt: site.portraitAlt || 'Ben Broome', credit: site.portraitCredit } : null

function interleaveByYear(items: Work[]): Work[] {
  const years = [...new Set(items.map((work) => work.year))].sort((a, b) => b - a)
  const categoryOrder: WorkCategory[] = ['Exhibition', 'Selected Writing', 'Performance', 'Talk', 'Artist Grant', 'Press']

  return years.flatMap((year) => {
    const inYear = items.filter((work) => work.year === year)
    const dated = inYear.filter((work) => work.sortDate).sort((a, b) =>
      (b.sortDate ?? '').localeCompare(a.sortDate ?? '') || a.order - b.order,
    )
    const undated = inYear.filter((work) => !work.sortDate).sort((a, b) => a.order - b.order)
    const queues = new Map(categoryOrder.map((category) => [
      category,
      undated.filter((work) => work.category === category),
    ]))
    const mixed: Work[] = []

    while (mixed.length < undated.length) {
      categoryOrder.forEach((category) => {
        const next = queues.get(category)?.shift()
        if (next) mixed.push(next)
      })
    }

    return [...dated, ...mixed]
  })
}

// Fixed abbreviations: newer runtimes write September as "Sept", which sits out of line.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function normalize(work: ContentWork): Work {
  const date = (work.date ?? '').trim()
  // A bare year sorts after the dated entries of that year, so it is not a sortDate.
  const sortDate = /^\d{4}-\d{2}(-\d{2})?$/.test(date) ? date : undefined
  return {
    slug: work.slug,
    legacySlug: work.legacySlug || undefined,
    title: work.title,
    indexTitle: work.indexTitle || work.title,
    type: work.type ?? '',
    publication: work.publication ?? '',
    date: sortDate ? `${MONTHS[Number(sortDate.slice(5, 7)) - 1]} ${sortDate.slice(0, 4)}` : date,
    year: Number(date.slice(0, 4)) || 0,
    description: work.description ?? '',
    images: (work.images ?? []).filter((image) => image.upload || image.src).map((image) => ({
      src: (image.upload || image.src)!,
      alt: image.alt || work.title,
      originalName: image.originalName || undefined,
      width: image.width ?? undefined,
      height: image.height ?? undefined,
      group: image.group || undefined,
      layout: image.layout || 'auto',
    })),
    imageOrder: work.imageOrder === 'manual' ? 'manual' : 'random',
    videos: (work.videos ?? []).map((video) => ({ src: video.src, label: video.label ?? '', group: video.group || undefined })),
    sortDate,
    files: (work.files ?? []).filter((file) => file.upload || file.href).map((file) => ({ label: file.label ?? '', href: (file.upload || file.href)!, display: file.display === 'link' ? 'link' : 'inline' })),
    links: work.links ?? [],
    externalHref: work.externalHref || null,
    featuredImage: work.featuredImage ?? '',
    order: work.order ?? 0,
    category: work.category as WorkCategory,
    alsoInWriting: Boolean(work.alsoInWriting) && work.category !== 'Selected Writing',
  }
}

// Press entries stay in content/works but are hidden from the site for now.
export const works: Work[] = interleaveByYear((data as ContentWork[]).map(normalize)).filter((work) => work.category !== 'Press')

// An exhibition text can be listed under Selected Writing as well as its own filter.
export const inFilter = (work: Work, category: WorkCategory) =>
  work.category === category || (category === 'Selected Writing' && work.alsoInWriting)

export const getWork = (slug: string) => works.find((work) => work.slug === slug)
export const getWorkByAnySlug = (slug: string) => works.find((work) => work.slug === slug || work.legacySlug === slug)

const isPdf = (href: string) => /\.pdf(?:$|[?#])/i.test(href)

// Publications that let their pages be shown inside another site. Others
// (Frieze, Ocula, Lafayette Anticipations, South London Gallery) refuse.
const EMBEDDABLE_HOSTS = ['flash---art.com', 'curamagazine.com', 'www.sieshoeke.com']

export function canEmbed(href: string): boolean {
  try {
    return EMBEDDABLE_HOSTS.includes(new URL(href).hostname)
  } catch {
    return false
  }
}

// The live page to show beside a project, when it has one and may be embedded.
export function embedHref(work: Work): string | undefined {
  if (!work.externalHref || work.files.some((file) => isPdf(file.href))) return undefined
  return canEmbed(work.externalHref) ? work.externalHref : undefined
}

// Only press mentions go straight to their link from the index. Every other
// project, including writing published elsewhere, opens its own page with the
// link beside its image.
export function opensExternally(work: Work): boolean {
  return Boolean(work.externalHref) && work.category === 'Press'
}

// On phones, writing and talks that are only a PDF open it directly.
export function directHref(work: Work): string | undefined {
  const pdf = work.files.find((file) => isPdf(file.href))
  const reading = work.category === 'Selected Writing' || work.category === 'Talk'
  return reading && pdf && !work.images.length ? `/api/document?src=${encodeURIComponent(pdf.href)}` : undefined
}

// Which project each slideshow image comes from, matched through the media bucket
// (the same photograph is stored once and used by both).
const storedAs = (path: string) => (mediaMap as Record<string, string>)[path]?.replace(/__[0-9a-f]{8}(?=\.)/, '')
const worksByImage = new Map(works.flatMap((work) => work.images.map((image) => [storedAs(image.src), work] as const)))
export const carouselWork = (src: string) => worksByImage.get(storedAs(src))

// Same curated 52-image sequence, mapped to the full-resolution migration files.
export const carouselImages = [
  '/carousel-hires/003.jpg', '/carousel-hires/004.jpg', '/carousel-hires/005.jpg',
  '/carousel-hires/006.jpg',
  '/carousel-hires/007.jpg', '/carousel-hires/008.jpg', '/carousel-hires/009.jpg',
  '/carousel-hires/010.jpg', '/carousel-hires/011.jpg', '/carousel-hires/012.jpg',
  '/carousel-hires/013.jpg', '/carousel-hires/014.jpg', '/carousel-hires/015.jpg',
  '/carousel-hires/016.png', '/carousel-hires/017.png', '/carousel-hires/018.png',
  '/carousel-hires/019.jpg', '/carousel-hires/020.jpg', '/carousel-hires/021.png',
  '/carousel-hires/022.png', '/carousel-hires/023.png', '/carousel-hires/024.jpg',
  '/carousel-hires/025.jpg', '/carousel-hires/026.jpg', '/carousel-hires/027.jpg',
  '/carousel-hires/028.jpg', '/carousel-hires/029.jpg', '/carousel-hires/030.jpg',
  '/carousel-hires/031.jpg', '/carousel-hires/032.jpg', '/carousel-hires/033.jpg',
  '/carousel-hires/034.jpg', '/carousel-hires/035.jpeg', '/carousel-hires/036.jpg',
  '/carousel-hires/037.jpg', '/carousel-hires/038.jpg', '/carousel-hires/039.jpg',
  '/carousel-hires/040.jpg', '/carousel-hires/041.jpg', '/carousel-hires/042.jpg',
  '/carousel-hires/043.jpg', '/carousel-hires/044.jpg', '/carousel-hires/045.jpg',
  '/carousel-hires/046.jpg', '/carousel-hires/047.jpg', '/carousel-hires/048.jpg',
  '/carousel-hires/049.jpeg', '/carousel-hires/050.jpeg', '/carousel-hires/051.png',
  '/carousel-hires/052.png',
] as const

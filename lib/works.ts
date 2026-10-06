import data from './generated/works.json'
import mediaMap from './media-map.json'

export type WorkCategory = 'Exhibition' | 'Selected Writing' | 'Performance' | 'Talk' | 'Artist Grant' | 'Press'

export type WorkImage = {
  src: string
  alt: string
  originalName?: string
  width?: number
  height?: number
  group?: string
}

export type WorkVideo = { src: string; label: string; group?: string }

export type WorkFile = {
  label: string
  href: string
}

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
  videos?: WorkVideo[]
  sortDate?: string
  files: WorkFile[]
  links: WorkFile[]
  externalHref: string | null
  featuredImage: string
  order: number
  category: WorkCategory
}

// One entry per file in content/works, edited at /keystatic. `date` is YYYY,
// YYYY-MM or YYYY-MM-DD depending on how precisely the date is known.
type ContentWork = {
  slug: string
  title: string
  indexTitle?: string
  category: string
  type?: string
  publication?: string
  date?: string
  description?: string
  externalHref?: string | null
  links?: WorkFile[]
  files?: WorkFile[]
  featuredImage?: string
  images?: Array<{ src: string; alt?: string; group?: string; width?: number | null; height?: number | null; originalName?: string }>
  videos?: Array<{ src: string; label?: string; group?: string }>
  legacySlug?: string
  order?: number | null
}

export const aboutParagraphs = [
  'Ben Broome (b. 1994) is a London-based curator with a focus on artists working at the convergence of mediums: musical performance and performance art, film and video art.',
  'With a human-centric approach to curation and the resulting art viewership, Broome sets out to create a borderless nucleus for artists and viewer alike, creating space for cross-generational exchange and attempting to engage new audiences, often through varied programming.',
]

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
    date: sortDate
      ? new Date(`${sortDate.length === 7 ? `${sortDate}-01` : sortDate}T12:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })
      : date,
    year: Number(date.slice(0, 4)) || 0,
    description: work.description ?? '',
    images: (work.images ?? []).map((image) => ({
      src: image.src,
      alt: image.alt || work.title,
      originalName: image.originalName || undefined,
      width: image.width ?? undefined,
      height: image.height ?? undefined,
      group: image.group || undefined,
    })),
    videos: (work.videos ?? []).map((video) => ({ src: video.src, label: video.label ?? '', group: video.group || undefined })),
    sortDate,
    files: work.files ?? [],
    links: work.links ?? [],
    externalHref: work.externalHref || null,
    featuredImage: work.featuredImage ?? '',
    order: work.order ?? 0,
    category: work.category as WorkCategory,
  }
}

// Press entries stay in content/works but are hidden from the site for now.
export const works: Work[] = interleaveByYear((data as ContentWork[]).map(normalize)).filter((work) => work.category !== 'Press')

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

// Projects that are nothing but a link go straight to it from the index.
export function opensExternally(work: Work): boolean {
  if (!work.externalHref) return false
  if (work.category === 'Press') return true
  return !embedHref(work) && !work.images.length && !work.files.length && !work.description
}

// On phones, writing and talks skip the project page and go straight to the
// article, or to the PDF when that is all there is.
export function directHref(work: Work): string | undefined {
  if (work.externalHref) return work.externalHref
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

import data from './generated/works.json'
import type { ImageLayout } from './gallery-layout'

// Projects as the site uses them. The editor at /keystatic writes one file per
// project to content/works; scripts/build-works.mjs collects and checks them
// into lib/generated/works.json, which is normalised and ordered here.

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

export type WorkLink = { label: string; href: string }

// A document is read on the project page, or listed with the links (a press release).
export type WorkDocument = WorkLink & { display: 'inline' | 'link' }

export type Work = {
  slug: string
  legacySlug?: string
  title: string
  indexTitle: string
  type: string
  publication: string
  /** As shown: "Sep 2025", or "2019" when only the year is known. */
  date: string
  /** "Sep", or empty when only the year is known. */
  month: string
  year: number
  /** YYYY-MM or YYYY-MM-DD; absent for year-only dates, which sort after dated ones. */
  sortDate?: string
  description: string
  images: WorkImage[]
  imageOrder: 'random' | 'manual'
  videos: WorkVideo[]
  files: WorkDocument[]
  links: WorkLink[]
  externalHref: string | null
  featuredImage: string
  order: number
  category: WorkCategory
  alsoInWriting: boolean
}

// The shape of a file in content/works. `date` is YYYY, YYYY-MM or YYYY-MM-DD,
// depending on how precisely it is known.
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
  links?: WorkLink[]
  files?: Array<{ label?: string; href?: string; upload?: string | null; display?: 'inline' | 'link' }>
  featuredImage?: string
  imageOrder?: 'random' | 'manual'
  // `upload` is a file added through the editor; `src` names one already in the media bucket.
  images?: Array<{ src?: string; upload?: string | null; alt?: string; group?: string; width?: number | null; height?: number | null; originalName?: string; layout?: ImageLayout }>
  videos?: Array<{ src: string; label?: string; group?: string }>
  legacySlug?: string
  order?: number | null
}

const CATEGORY_ORDER: WorkCategory[] = ['Exhibition', 'Selected Writing', 'Performance', 'Talk', 'Artist Grant', 'Press']

// Fixed abbreviations: newer runtimes write September as "Sept", which sits out of line.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function normalize(work: ContentWork): Work {
  const date = (work.date ?? '').trim()
  const sortDate = /^\d{4}-\d{2}(-\d{2})?$/.test(date) ? date : undefined
  const month = sortDate ? MONTHS[Number(sortDate.slice(5, 7)) - 1] : ''
  return {
    slug: work.slug,
    legacySlug: work.legacySlug || undefined,
    title: work.title,
    indexTitle: work.indexTitle || work.title,
    type: work.type ?? '',
    publication: work.publication ?? '',
    date: month ? `${month} ${date.slice(0, 4)}` : date,
    month,
    year: Number(date.slice(0, 4)) || 0,
    sortDate,
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
    files: (work.files ?? []).filter((file) => file.upload || file.href).map((file) => ({
      label: file.label ?? '',
      href: (file.upload || file.href)!,
      display: file.display === 'link' ? 'link' : 'inline',
    })),
    links: (work.links ?? []).filter((link) => link.label && link.href),
    externalHref: work.externalHref || null,
    featuredImage: work.featuredImage ?? '',
    order: work.order ?? 0,
    category: work.category as WorkCategory,
    alsoInWriting: Boolean(work.alsoInWriting) && work.category !== 'Selected Writing',
  }
}

// Newest year first. Within a year, precisely dated projects come first, newest
// first; year-only projects follow, taking turns by category so one kind does
// not run on in a block.
function orderByYear(items: Work[]): Work[] {
  const years = [...new Set(items.map((work) => work.year))].sort((a, b) => b - a)
  return years.flatMap((year) => {
    const inYear = items.filter((work) => work.year === year)
    const dated = inYear.filter((work) => work.sortDate).sort((a, b) => b.sortDate!.localeCompare(a.sortDate!) || a.order - b.order)
    const undated = inYear.filter((work) => !work.sortDate).sort((a, b) => a.order - b.order)
    const queues = CATEGORY_ORDER.map((category) => undated.filter((work) => work.category === category))
    const mixed: Work[] = []
    while (mixed.length < undated.length) {
      for (const queue of queues) {
        const next = queue.shift()
        if (next) mixed.push(next)
      }
    }
    return [...dated, ...mixed]
  })
}

// Press entries stay in content/works but are hidden from the site for now.
export const works: Work[] = orderByYear((data as ContentWork[]).map(normalize)).filter((work) => work.category !== 'Press')

// An exhibition text can be listed under Selected Writing as well as its own filter.
export const inFilter = (work: Work, category: WorkCategory) =>
  work.category === category || (category === 'Selected Writing' && work.alsoInWriting)

// Under Selected Writing, an exhibition listed there is named for its text.
export const typeIn = (work: Work, category: WorkCategory | 'All') =>
  category === 'Selected Writing' && work.alsoInWriting ? 'Exhibition text' : work.type

export const getWorkByAnySlug = (slug: string) => works.find((work) => work.slug === slug || work.legacySlug === slug)

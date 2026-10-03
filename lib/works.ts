import data from './works.json'
import researchedDates from './date-research.json'
import projectResources from './project-resources.json'

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

type RawWork = Work & { sourceSlug?: string; sourceUrl?: string; preserveTitle?: boolean }
type ResearchedDate = { sortDate: string; publication?: string; sources: string[]; note: string }
const dateResearch = researchedDates as Record<string, ResearchedDate>
const resources = projectResources as Record<string, { files: WorkFile[]; links: WorkFile[] }>

export const aboutParagraphs = [
  'Ben Broome (b. 1994) is a London-based curator with a focus on artists working at the convergence of mediums: musical performance and performance art, film and video art.',
  'With a human-centric approach to curation and the resulting art viewership, Broome sets out to create a borderless nucleus for artists and viewer alike, creating space for cross-generational exchange and attempting to engage new audiences, often through varied programming.',
]

const otherTitles = new Set(
  (data.works as RawWork[]).map((work) => work.title.trim().toLowerCase()).filter(Boolean),
)

function cleanDescription(work: RawWork) {
  // The Squarespace writing/press index exposes listing labels, not article body
  // copy. Repeating those labels in the detail panel duplicates title and date.
  if (work.category === 'Selected Writing' || work.category === 'Press') return ''
  return work.description
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false
      if (/^download /i.test(line)) return false
      if (resources[work.slug]?.links.some((link) => link.label === line)) return false
      const lower = line.toLowerCase()
      if (lower === work.title.toLowerCase()) return false
      return ![...otherTitles].some((title) => title !== work.title.toLowerCase() && (lower === title || lower.startsWith(`${title},`)))
    })
    .join('\n\n')
}

function filesFor(work: RawWork) {
  if (resources[work.slug]) return resources[work.slug].files
  if (work.sortDate) return work.files ?? []
  if (work.category === 'Selected Writing' || work.category === 'Press') return work.files ?? []
  const tokens = work.title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 4)
  if (!tokens.length) return work.files ?? []
  return (work.files ?? []).filter((file) => {
    const haystack = `${file.label} ${file.href}`.toLowerCase()
    return tokens.some((token) => haystack.includes(token))
  })
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const
const MONTH_PATTERN = MONTHS.join('|')
const MONTH_YEAR_RE = new RegExp(`(${MONTH_PATTERN})\\s+(\\d{4})`, 'i')

function sortDateFor(work: RawWork): string | undefined {
  if (dateResearch[work.slug]) return dateResearch[work.slug].sortDate
  if (work.sortDate) return work.sortDate
  const match = `${work.date} ${work.title}`.match(MONTH_YEAR_RE)
  if (!match || Number(match[2]) !== work.year) return undefined
  const month = MONTHS.findIndex((name) => name.toLowerCase() === match[1].toLowerCase()) + 1
  return `${work.year}-${String(month).padStart(2, '0')}`
}
const DATE_SUFFIX_RE = new RegExp(`\\s+[—–-]\\s+(${MONTH_PATTERN})\\s+(\\d{4})$`, 'i')

// Ensures a space before an opening quote and after a closing quote when they sit
// directly against a word character — e.g. Artist"Title"Review → Artist "Title" Review.
// Handles straight quotes (") and curly quotes (" ").
function fixQuoteSpacing(title: string): string {
  return title
    .replace(/(\S)([“"])/g, '$1 $2')
    .replace(/([”"])(\S)/g, '$1 $2')
    .replace(/\s+'\s*/g, "'")
}

function cleanTitle(work: RawWork): string {
  if (work.category !== 'Selected Writing' && work.category !== 'Press') return work.title
  const withoutDate = work.title.replace(DATE_SUFFIX_RE, '').trim()
  return fixQuoteSpacing(withoutDate)
    .replace(/\s+-\s+/g, ' — ')
    .replace(/\s+([,.;:!?])/g, '$1')
}

function cleanDate(work: RawWork, sortDate: string | undefined): string {
  if (sortDate) return new Date(`${sortDate.length === 7 ? `${sortDate}-01` : sortDate}T12:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })
  return work.year ? String(work.year) : ''
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function interleaveByYear(items: Work[]): Work[] {
  const years = [...new Set(items.map((work) => work.year))].sort((a, b) => b - a)
  const categoryOrder: WorkCategory[] = ['Exhibition', 'Selected Writing', 'Performance', 'Talk', 'Artist Grant', 'Press']

  return years.flatMap((year) => {
    const inYear = items.filter((work) => work.year === year)
    const dated = inYear.filter((work) => work.sortDate).sort((a, b) =>
      (b.sortDate ?? '').localeCompare(a.sortDate ?? '') || a.order - b.order,
    )
    const undated = inYear.filter((work) => !work.sortDate)
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

function normalize(work: RawWork): Work {
  const writing = work.category === 'Selected Writing'
  const press = work.category === 'Press'
  const title = cleanTitle(work)
  const slug = writing && !work.preserveTitle ? slugify(title) : work.slug
  const sortDate = sortDateFor(work)
  return {
    slug,
    legacySlug: slug !== work.slug ? work.slug : undefined,
    title,
    type: writing && !work.preserveTitle ? 'Writing' : work.type,
    publication: dateResearch[work.slug]?.publication ?? work.publication,
    date: cleanDate(work, sortDate),
    year: sortDate ? Number(sortDate.slice(0, 4)) : work.year,
    description: cleanDescription(work),
    images: press ? [] : work.images,
    videos: work.videos ?? [],
    sortDate,
    files: filesFor(work),
    links: resources[work.slug]?.links ?? [],
    externalHref: work.externalHref,
    featuredImage: press ? '' : work.featuredImage,
    order: work.order,
    category: work.category,
  }
}

export const works: Work[] = interleaveByYear(
  (data.works as RawWork[]).map(normalize),
)

export const getWork = (slug: string) => works.find((work) => work.slug === slug)
export const getWorkByAnySlug = (slug: string) => works.find((work) => work.slug === slug || work.legacySlug === slug)

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

import { mediaHref } from './media'
import type { Work, WorkDocument, WorkImage, WorkLink } from './works'

// What a project page shows, decided from the project alone so the rules can be
// checked without rendering (scripts/check-portfolio.cjs).

export const isPdf = (href: string) => /\.pdf(?:$|[?#])/i.test(href)

// Pages rendered from a PDF stand in for it in the editor and stay out of the gallery.
export const isPdfPage = (image: WorkImage) => /\.pdf$/i.test(image.originalName ?? '')

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

export const documentHref = (href: string) => `/api/document?src=${encodeURIComponent(href)}`

// On phones, writing and talks that are only a PDF open it directly.
export function directHref(work: Work): string | undefined {
  const pdf = work.files.find((file) => isPdf(file.href))
  const reading = work.category === 'Selected Writing' || work.category === 'Talk'
  return reading && pdf && !work.images.length ? documentHref(pdf.href) : undefined
}

export type ProjectView = {
  /** PDFs read on the page; any others are listed with the links. */
  documents: WorkDocument[]
  /** A single exhibition text read in the flow of the gallery, after the opening image. */
  textBelow: boolean
  /** Whether the page opens on the first document rather than the images. */
  opensOnDocument: boolean
  /** Whether there is an Images view to switch back to from a document. */
  hasImages: boolean
  /** Writing whose only form here is a scan of the page: its images open in the reader. */
  readsAsImage: boolean
  /** The publication's own page, shown live in place of the gallery. */
  article?: string
  /** Linked pages shown live after the gallery. */
  relatedPages: WorkLink[]
  /** The links in the left column, in order. */
  links: WorkLink[]
}

export function projectView(work: Work): ProjectView {
  // Exhibition documents and press stay in the left-hand links, even when
  // older content (or an editor save) requests an inline reader.
  const exhibition = work.category === 'Exhibition'
  const documents = work.files.filter((file) => !exhibition && isPdf(file.href) && file.display !== 'link')
  const imageCount = work.images.filter((image) => !isPdfPage(image)).length
  const reading = work.category === 'Selected Writing' || work.category === 'Talk'
  const textBelow = documents.length === 1 && imageCount > 0 && !reading
  const article = !exhibition && work.externalHref && canEmbed(work.externalHref) && !work.files.some((file) => isPdf(file.href)) ? work.externalHref : undefined
  return {
    documents,
    textBelow,
    opensOnDocument: !textBelow && documents.length > 0 && (reading || imageCount === 0),
    hasImages: imageCount > 0 && !(documents.length > 0 && work.category === 'Selected Writing'),
    readsAsImage: work.category === 'Selected Writing' && imageCount > 0 && !work.externalHref && !work.files.length,
    article,
    relatedPages: !exhibition && imageCount > 0 && !article ? work.links.filter((link) => canEmbed(link.href)) : [],
    links: projectLinks(work, documents),
  }
}

function projectLinks(work: Work, documents: WorkDocument[]): WorkLink[] {
  const fileLink = (file: WorkDocument) => ({ label: file.label.replace(/\.pdf$/i, '') || 'File', href: mediaHref(file.href) })
  const others = work.files.filter((file) => !documents.includes(file))
  const listed = others.filter((file) => file.display === 'link').map(fileLink)
  const publication = work.publication.split(',')[0]

  if (work.category === 'Selected Writing') {
    const readHref = work.files[0] ? mediaHref(work.files[0].href) : work.externalHref
    const read = !documents.length && readHref
      ? [{ label: readHref === work.externalHref && publication ? `Read on ${publication}` : 'Read', href: readHref }]
      : []
    return withoutRepeats([...read, ...listed])
  }

  return withoutRepeats([
    ...others.filter((file) => file.display !== 'link').map(fileLink),
    ...(work.externalHref ? [{ label: publication || 'Link', href: work.externalHref }] : []),
    ...work.links,
    // Press releases and exhibition texts read on the page are also linked here.
    ...(work.category === 'Talk' ? [] : documents.map(fileLink)),
    ...listed,
  ])
}

const withoutRepeats = (links: WorkLink[]) => links.filter((link, index) => links.findIndex((other) => other.href === link.href) === index)

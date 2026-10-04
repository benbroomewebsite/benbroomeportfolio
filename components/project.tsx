'use client'

import Image from 'next/image'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { type CSSProperties, useState } from 'react'
import { mediaHref } from '@/lib/media'
import type { Work, WorkImage } from '@/lib/works'

const PdfReader = dynamic(() => import('@/components/pdf-reader'), {
  ssr: false,
  loading: () => <p className="pdf-status" role="status">Loading document reader…</p>,
})

const ratioOf = (image: WorkImage) => (image.width && image.height ? image.width / image.height : 4 / 3)
const isPortrait = (image: WorkImage) => ratioOf(image) < 0.95
const GALLERY_GAP = 18

// Lays a gallery out as rows: portraits share a row, and landscapes alternate
// between a full-width image and a pair, so long galleries keep a rhythm.
function galleryRows(images: WorkImage[]): WorkImage[][] {
  const rows: WorkImage[][] = []
  let pairLandscapes = false
  for (let index = 0; index < images.length;) {
    const image = images[index]
    const next = images[index + 1]
    const pair: boolean = Boolean(next) && (isPortrait(image) || (pairLandscapes && !isPortrait(next)))
    rows.push(pair ? [image, next] : [image])
    if (!isPortrait(image)) pairLandscapes = !pair
    index += pair ? 2 : 1
  }
  return rows
}

// The widest a row can be before its smallest image is stretched past its own
// pixels, which is what makes low-resolution archive photos look blurry.
function rowMaxWidth(row: WorkImage[]): number | undefined {
  if (row.some((image) => !image.width || !image.height)) return undefined
  // A lone portrait takes half the row, so the row may be twice its width.
  if (row.length === 1 && isPortrait(row[0])) return row[0].width! * 2 + GALLERY_GAP
  const height = Math.min(...row.map((image) => image.height!))
  return Math.round(row.reduce((total, image) => total + ratioOf(image) * height, 0) + GALLERY_GAP * (row.length - 1))
}

export function ProjectPage({ work }: { work: Work }) {
  const pdfs = work.files.filter((file) => /\.pdf(?:$|[?#])/i.test(file.href))
  const galleryImages = work.images.filter((image) => !/\.pdf$/i.test(image.originalName ?? ''))
  const pdfFirst = pdfs.length > 0 && (work.category === 'Selected Writing' || work.category === 'Talk' || galleryImages.length === 0)
  const [documentIndex, setDocumentIndex] = useState<number | null>(pdfFirst ? 0 : null)
  const document = documentIndex !== null ? pdfs[documentIndex] : undefined
  const showImages = galleryImages.length > 0 && !(pdfs.length > 0 && work.category === 'Selected Writing')
  const galleryGroups = [...new Set([
    ...galleryImages.map((image) => image.group ?? ''),
    ...(work.videos ?? []).filter((video) => video.group).map((video) => video.group!),
  ])]
  const paragraphs = work.description ? work.description.split(/\n\n+/) : []
  const writingHref = work.files[0]?.href ? mediaHref(work.files[0].href) : work.externalHref
  const links = work.category === 'Selected Writing'
    ? (!pdfs.length && writingHref ? [{ label: 'Read', href: writingHref }] : [])
    : [
        ...work.files.filter((file) => !pdfs.includes(file)).map((file) => ({ label: file.label.replace(/\.pdf$/i, '') || 'File', href: mediaHref(file.href) })),
        ...(work.externalHref ? [{ label: 'Link', href: work.externalHref }] : []),
        ...work.links,
      ]
  const date = work.sortDate?.length === 10
    ? new Date(`${work.sortDate}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    : work.date

  return <main className={`project-page${document ? ' project-page-reading' : ''}`}>
    <aside className="project-navigation">
      <header className="identity"><Link href="/"><span>Ben Broome</span></Link><p>Curator, writer and organiser</p></header>
      <nav aria-label="Portfolio navigation"><Link href="/" className="index-return">← Back to index</Link></nav>
      <div className="project project-info">
        <header>
          <h1>{work.title}</h1>
          <p>{[work.type, work.publication, date].filter(Boolean).join(' · ')}</p>
        </header>
        {paragraphs.length > 0 && <div className="project-copy">
          {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>}
        {links.length > 0 && <div className="project-links">
          {links.map((link) => <a key={link.href} href={link.href} target={link.href.startsWith('/') ? undefined : '_blank'} rel={link.href.startsWith('/') ? undefined : 'noreferrer'}>↳ {link.label}</a>)}
        </div>}
        {pdfs.length > 0 && (showImages || pdfs.length > 1) && <nav className="project-media-tabs" aria-label="Project media">
          {showImages && <button aria-pressed={documentIndex === null} onClick={() => setDocumentIndex(null)}>Images</button>}
          {pdfs.filter((_, index) => pdfs.length > 1 || documentIndex !== index).map((file) => <button key={file.href} aria-pressed={documentIndex === pdfs.indexOf(file)} onClick={() => setDocumentIndex(pdfs.indexOf(file))}>
            {pdfs.length === 1 ? 'Read' : file.label.replace(/^Download\s+/i, '').replace(/\.pdf$/i, '') || 'Read'}
          </button>)}
        </nav>}
      </div>
    </aside>
    <section className="project-content" aria-label={`${work.title} media`}>
      {document && <PdfReader key={document.href} source={document.href} label={work.title} />}
      {!document && galleryGroups.length > 0 && <div className="project-gallery">
        {galleryGroups.map((group) => <section className="gallery-group" key={group}>
          {group && <h2>{group}</h2>}
          {galleryRows(galleryImages.filter((image) => (image.group ?? '') === group)).map((row) => <div
            key={row[0].src}
            className={`gallery-row${row.length === 1 && isPortrait(row[0]) ? ' gallery-row-narrow' : ''}`}
            style={{ maxWidth: rowMaxWidth(row) }}
          >
            {row.map((image) => <Image
              key={image.src}
              src={mediaHref(image.src)}
              alt={image.alt}
              width={image.width ?? 1600}
              height={image.height ?? 1200}
              sizes="(max-width: 800px) 100vw, 66vw"
              style={{ '--ratio': ratioOf(image) } as CSSProperties}
            />)}
          </div>)}
          {(work.videos ?? []).filter((video) => video.group === group).map((video) => <Video key={video.src} video={video} />)}
        </section>)}
      </div>}
      {!document && (work.videos ?? []).filter((video) => !video.group).map((video) => <Video key={video.src} video={video} />)}
      <nav className="project-return-bottom" aria-label="Return to index"><Link href="/" className="index-return">← Back to index</Link></nav>
    </section>
  </main>
}

// The index hover preview: title, details and one image.
export function Project({ work }: { work: Work }) {
  const preview = work.images.find((image) => image.src === work.featuredImage) ?? work.images[0]

  return <article className="project">
    <header>
      <h1>{work.title}</h1>
      <p>{[work.type, work.publication, work.date].filter(Boolean).join(' · ')}</p>
    </header>
    {preview && <div className="project-media">
      <Image src={mediaHref(preview.src)} alt={preview.alt} fill sizes="(max-width: 800px) 100vw, 40vw" priority />
    </div>}
  </article>
}

function Video({ video }: { video: NonNullable<Work['videos']>[number] }) {
  return <figure className="project-video">
    <video controls playsInline preload="metadata" aria-label={video.label}>
      <source src={mediaHref(video.src)} type="video/mp4" />
      <a href={mediaHref(video.src)}>Download video</a>
    </video>
    <figcaption>{video.label}</figcaption>
  </figure>
}

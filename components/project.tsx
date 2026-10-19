'use client'

import Image from 'next/image'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { type CSSProperties, Fragment, type ReactNode, useEffect, useState } from 'react'
import { mediaHref } from '@/lib/media'
import { canEmbed, embedHref, type Work, type WorkImage } from '@/lib/works'
import { Identity } from '@/components/identity'
import { useRandomOrder } from '@/lib/use-random-order'
import { galleryRows, isNarrowRow, isPortrait, ratioOf, rowMaxWidth } from '@/lib/gallery-layout'

const PdfReader = dynamic(() => import('@/components/pdf-reader'), {
  ssr: false,
  loading: () => <p className="pdf-status" role="status">Loading document reader…</p>,
})

// Names in the text that have a link of their own (grant recipients, judges)
// become that link, once each, and drop out of the list of links below.
function linkNames(paragraphs: string[], links: Array<{ label: string; href: string }>) {
  const unused = [...links].sort((a, b) => b.label.length - a.label.length)
  const linked = paragraphs.map((paragraph) => {
    const parts: ReactNode[] = []
    let rest = paragraph
    while (rest) {
      const hits = unused.map((link) => ({ link, at: rest.indexOf(link.label) })).filter((hit) => hit.at >= 0).sort((a, b) => a.at - b.at)
      if (!hits.length) break
      const { link, at } = hits[0]
      parts.push(rest.slice(0, at), <a key={link.href} href={link.href} target="_blank" rel="noreferrer">{link.label}</a>)
      rest = rest.slice(at + link.label.length)
      unused.splice(unused.indexOf(link), 1)
    }
    return [...parts, rest]
  })
  return { linked, remaining: links.filter((link) => unused.includes(link)) }
}

export function ProjectPage({ work }: { work: Work }) {
  const pdfs = work.files.filter((file) => /\.pdf(?:$|[?#])/i.test(file.href))
  const shuffledImages = useRandomOrder(work.images, work.imageOrder !== 'manual')
  const galleryImages = shuffledImages.filter((image) => !/\.pdf$/i.test(image.originalName ?? ''))
  // Exhibitions and performances keep their images and show the text beneath them.
  const textBelow = pdfs.length === 1 && galleryImages.length > 0 && work.category !== 'Selected Writing' && work.category !== 'Talk'
  const pdfFirst = !textBelow && pdfs.length > 0 && (work.category === 'Selected Writing' || work.category === 'Talk' || galleryImages.length === 0)
  const [documentIndex, setDocumentIndex] = useState<number | null>(pdfFirst ? 0 : null)
  const document = documentIndex !== null ? pdfs[documentIndex] : undefined
  // With ?edit on the address, each image shows its position and name as listed in the editor.
  const [labelled, setLabelled] = useState(false)
  useEffect(() => setLabelled(new URLSearchParams(window.location.search).has('edit')), [])
  const showImages = galleryImages.length > 0 && !(pdfs.length > 0 && work.category === 'Selected Writing')
  const galleryGroups = [...new Set([
    ...work.images.filter((image) => !/\.pdf$/i.test(image.originalName ?? '')).map((image) => image.group ?? ''),
    ...(work.videos ?? []).filter((video) => video.group).map((video) => video.group!),
  ])]
  // The first video without a section of its own sits under the opening image; the rest follow the gallery.
  const looseVideos = (work.videos ?? []).filter((video) => !video.group)
  const leadVideo = galleryImages.some((image) => !image.group) ? looseVideos[0] : undefined
  // The lead video shares its row with the first portrait after the opening image, so it sits smaller beside a photo.
  const looseImages = galleryImages.filter((image) => !image.group)
  const videoPartner = leadVideo ? looseImages.slice(1).find(image => isPortrait(image) && (!image.layout || image.layout === 'auto')) : undefined
  const galleryItem = (image: WorkImage) => {
    const picture = <Image src={mediaHref(image.src)} alt={image.alt} width={image.width ?? 1600} height={image.height ?? 1200} sizes="(max-width: 800px) 100vw, 66vw" />
    const style = { '--ratio': ratioOf(image) } as CSSProperties
    const label = labelled && <span className="gallery-label">{work.images.indexOf(image) + 1} · {image.src.split('/').pop()}<br /><small>{image.src}</small></span>
    // An image on a project that lives elsewhere leads to it, like the link does.
    return work.externalHref && !labelled
      ? <a key={image.src} className="gallery-item" style={style} href={work.externalHref} target="_blank" rel="noreferrer">{picture}</a>
      : <div key={image.src} className="gallery-item" style={style}>{picture}{label}</div>
  }
  // The exhibition text follows the opening image, in the flow of the page, so one scroll reads through it.
  const textAfterLead = textBelow && galleryImages.some((image) => !image.group)
  const exhibitionText = textBelow ? <div className="project-text-below"><PdfReader source={pdfs[0].href} label={work.title} /></div> : null
  const paragraphs = work.description ? work.description.split(/\n\n+/) : []
  const writingHref = work.files[0]?.href ? mediaHref(work.files[0].href) : work.externalHref
  const links = work.category === 'Selected Writing'
    ? (!pdfs.length && writingHref ? [{ label: 'Read', href: writingHref }] : [])
    : [
        ...work.files.filter((file) => !pdfs.includes(file)).map((file) => ({ label: file.label.replace(/\.pdf$/i, '') || 'File', href: mediaHref(file.href) })),
        ...(work.externalHref ? [{ label: work.publication.split(',')[0] || 'Link', href: work.externalHref }] : []),
        ...work.links,
      ]
  const article = embedHref(work)
  // Related writing that can be shown live follows the images, after any exhibition text.
  const relatedPages = galleryImages.length > 0 && !article ? work.links.filter((link) => canEmbed(link.href)) : []
  const { linked, remaining } = linkNames(paragraphs, links)
  const date = work.sortDate?.length === 10
    ? new Date(`${work.sortDate}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    : work.date

  return <main className={`project-page${work.description.length > 900 ? ' project-page-text' : ''}${document ? ' project-page-reading' : ''}${article ? ' project-page-article' : ''}`}>
    <aside className="project-navigation">
      <Identity tagline={false} />
      <nav aria-label="Portfolio navigation"><Link href="/" className="index-return">← Back to index</Link></nav>
      <div className="project project-info">
        <header>
          <h1>{work.title}</h1>
          <p>{[work.type, work.publication, date].filter(Boolean).join(' · ')}</p>
        </header>
        {paragraphs.length > 0 && <div className="project-copy">
          {linked.map((paragraph, index) => <p key={paragraphs[index]}>{paragraph}</p>)}
        </div>}
        {remaining.length > 0 && <div className="project-links">
          {remaining.map((link) => <a key={link.href} href={link.href} target={link.href.startsWith('/') ? undefined : '_blank'} rel={link.href.startsWith('/') ? undefined : 'noreferrer'}>↳ {link.label}</a>)}
        </div>}
        {!textBelow && pdfs.length > 0 && (showImages || pdfs.length > 1) && <nav className="project-media-tabs" aria-label="Project media">
          {showImages && <button aria-pressed={documentIndex === null} onClick={() => setDocumentIndex(null)}>Images</button>}
          {pdfs.filter((_, index) => pdfs.length > 1 || documentIndex !== index).map((file) => <button key={file.href} aria-pressed={documentIndex === pdfs.indexOf(file)} onClick={() => setDocumentIndex(pdfs.indexOf(file))}>
            {pdfs.length === 1 ? 'Read' : file.label.replace(/^Download\s+/i, '').replace(/\.pdf$/i, '') || 'Read'}
          </button>)}
        </nav>}
      </div>
    </aside>
    <section className="project-content" aria-label={`${work.title} media`}>
      {document && <PdfReader key={document.href} source={document.href} label={work.title} />}
      {article && <iframe className="article-frame" src={article} title={`${work.title} — ${work.publication}`} loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" />}
      {!document && galleryGroups.length > 0 && <div className="project-gallery">
        {galleryGroups.map((group) => <section className="gallery-group" key={group}>
          {group && <h2>{group}</h2>}
          {galleryRows(galleryImages.filter((image) => (image.group ?? '') === group && image !== videoPartner)).map((row, rowIndex) => <Fragment key={row[0].src}><div
            className={`gallery-row${isNarrowRow(row) ? ' gallery-row-narrow' : ''}${row[0].layout === 'right' || (isNarrowRow(row) && (!row[0].layout || row[0].layout === 'auto') && rowIndex % 2 === 1) ? ' gallery-row-right' : ''}${row[0].layout === 'left' ? ' gallery-row-left' : ''}`}
            style={{ maxWidth: rowMaxWidth(row) }}
          >
            {row.map(galleryItem)}
          </div>
          {!group && rowIndex === 0 && leadVideo && (videoPartner
            ? <div className="gallery-row">{galleryItem(videoPartner)}<Video video={leadVideo} beside /></div>
            : <Video video={leadVideo} />)}
          {!group && rowIndex === 0 && textBelow && exhibitionText}
          </Fragment>)}
          {(work.videos ?? []).filter((video) => video.group === group).map((video) => <Video key={video.src} video={video} />)}
        </section>)}
      </div>}
      {!document && looseVideos.filter((video) => video !== leadVideo).map((video) => <Video key={video.src} video={video} />)}
      {textBelow && !textAfterLead && exhibitionText}
      {!document && relatedPages.map((link) => <section key={link.href} className="project-related">
        <h2><a href={link.href} target="_blank" rel="noreferrer">↳ {link.label}</a></h2>
        <iframe className="article-frame" src={link.href} title={link.label} loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" />
      </section>)}
      <nav className="project-return-bottom" aria-label="Return to index"><Link href="/" className="index-return">← Back to index</Link></nav>
    </section>
  </main>
}

// The index hover preview: title, details and one image.
export function Project({ work }: { work: Work }) {
  const images = useRandomOrder(work.images)
  const preview = images[0]?.src || work.featuredImage

  return <article className="project">
    <header>
      <h1>{work.title}</h1>
      <p>{[work.type, work.publication, work.date].filter(Boolean).join(' · ')}</p>
    </header>
    {preview && <div className="project-media">
      <Image src={mediaHref(preview)} alt={work.title} fill sizes="(max-width: 800px) 100vw, 30vw" priority />
    </div>}
  </article>
}

// Beside a photo the video takes a share of the row by its shape (the films are 16:9) and drops its caption.
function Video({ video, beside = false }: { video: NonNullable<Work['videos']>[number]; beside?: boolean }) {
  return <figure className={`project-video${beside ? ' gallery-item' : ''}`} style={beside ? { '--ratio': 16 / 9 } as CSSProperties : undefined}>
    <video controls playsInline preload="metadata" aria-label={video.label}>
      <source src={mediaHref(video.src)} type="video/mp4" />
      <a href={mediaHref(video.src)}>Download video</a>
    </video>
    {!beside && <figcaption>{video.label}</figcaption>}
  </figure>
}

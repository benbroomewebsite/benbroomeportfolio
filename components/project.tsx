'use client'

import Image from 'next/image'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useState } from 'react'
import { mediaHref } from '@/lib/media'
import type { Work } from '@/lib/works'

const PdfReader = dynamic(() => import('@/components/pdf-reader'), {
  ssr: false,
  loading: () => <p className="pdf-status" role="status">Loading document reader…</p>,
})

export function ProjectPage({ work }: { work: Work }) {
  return <main className="project-page">
    <aside className="project-navigation">
      <header className="identity"><Link href="/"><span>Ben Broome</span></Link><p>Curator, writer and organiser</p></header>
      <nav aria-label="Portfolio navigation"><Link href="/" className="index-return">← Back to index</Link></nav>
    </aside>
    <section className="project-content" aria-label={work.title}>
      <Project key={work.slug} work={work} expanded />
    </section>
  </main>
}

export function Project({ work, expanded }: { work: Work; expanded: boolean }) {
  const pdfs = work.files.filter((file) => /\.pdf(?:$|[?#])/i.test(file.href))
  const galleryImages = work.images.filter((image) => !/\.pdf$/i.test(image.originalName ?? ''))
  const pdfFirst = pdfs.length > 0 && (work.category === 'Selected Writing' || work.category === 'Talk' || galleryImages.length === 0)
  const [documentIndex, setDocumentIndex] = useState<number | null>(pdfFirst ? 0 : null)
  const document = expanded && documentIndex !== null ? pdfs[documentIndex] : undefined
  const showImages = galleryImages.length > 0 && !(pdfs.length > 0 && work.category === 'Selected Writing')
  const preview = work.images.find((image) => image.src === work.featuredImage) ?? work.images[0]
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
  const date = expanded && work.sortDate?.length === 10
    ? new Date(`${work.sortDate}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    : work.date

  return <article className={`project${expanded ? ' project-full' : ''}${document ? ' project-reading' : ''}`}>
    <header>
      <h1>{work.title}</h1>
      <p>{[work.type, work.publication, date].filter(Boolean).join(' · ')}</p>
    </header>
    {expanded && paragraphs.length > 0 && <div className="project-copy">
      {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
    </div>}
    {expanded && links.length > 0 && <div className="project-links">
      {links.map((link) => <a key={link.href} href={link.href} target={link.href.startsWith('/') ? undefined : '_blank'} rel={link.href.startsWith('/') ? undefined : 'noreferrer'}>↳ {link.label}</a>)}
    </div>}
    {expanded && pdfs.length > 0 && (showImages || pdfs.length > 1) && <nav className="project-media-tabs" aria-label="Project media">
      {showImages && <button aria-pressed={documentIndex === null} onClick={() => setDocumentIndex(null)}>Images</button>}
      {pdfs.filter((_, index) => pdfs.length > 1 || documentIndex !== index).map((file) => <button key={file.href} aria-pressed={documentIndex === pdfs.indexOf(file)} onClick={() => setDocumentIndex(pdfs.indexOf(file))}>
        {pdfs.length === 1 ? 'Read' : file.label.replace(/^Download\s+/i, '').replace(/\.pdf$/i, '') || 'Read'}
      </button>)}
    </nav>}
    {document && <PdfReader key={document.href} source={document.href} label={work.title} />}
    {!expanded && preview && <div className="project-media">
      <Image src={mediaHref(preview.src)} alt={preview.alt} fill sizes="(max-width: 800px) 100vw, 40vw" priority />
    </div>}
    {expanded && !document && galleryGroups.length > 0 && <div className="project-gallery">
      {galleryGroups.map((group) => <section className="gallery-group" key={group}>
        {group && <h2>{group}</h2>}
        {galleryImages.filter((image) => (image.group ?? '') === group).map((image) => <Image
          key={image.src}
          src={mediaHref(image.src)}
          alt={image.alt}
          width={image.width ?? 1600}
          height={image.height ?? 1200}
          sizes="(max-width: 800px) 100vw, 52vw"
        />)}
        {(work.videos ?? []).filter((video) => video.group === group).map((video) => <Video key={video.src} video={video} />)}
      </section>)}
    </div>}
    {expanded && !document && (work.videos ?? []).filter((video) => !video.group).map((video) => <Video key={video.src} video={video} />)}
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

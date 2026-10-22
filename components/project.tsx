'use client'

import Image from 'next/image'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { mediaHref } from '@/lib/media'
import { isPdfPage, projectView } from '@/lib/project-view'
import { useRandomOrder } from '@/lib/use-random-order'
import type { Work } from '@/lib/works'
import { Identity } from '@/components/identity'
import { ProjectGallery } from '@/components/project-gallery'
import { ProjectText } from '@/components/project-text'

const PdfReader = dynamic(() => import('@/components/pdf-reader'), {
  ssr: false,
  loading: () => <p className="pdf-status" role="status">Loading document reader…</p>,
})

const IFRAME_SANDBOX = 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox'

// The full date on a project page: "4 October 2025", or as the index shows it.
function longDate(work: Work) {
  return work.sortDate?.length === 10
    ? new Date(`${work.sortDate}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    : work.date
}

// A project page: title, text and links in a narrow left column; the gallery,
// videos, a document or the publication's own page fill the rest.
export function ProjectPage({ work }: { work: Work }) {
  const view = projectView(work)
  const { documents } = view
  const images = useRandomOrder(work.images, work.imageOrder !== 'manual').filter((image) => !isPdfPage(image))
  const [documentIndex, setDocumentIndex] = useState<number | null>(view.opensOnDocument ? 0 : null)
  const document = documentIndex !== null ? documents[documentIndex] : undefined
  // With ?edit on the address, each image shows its position and name as listed in the editor.
  const [labelled, setLabelled] = useState(false)
  useEffect(() => setLabelled(new URLSearchParams(window.location.search).has('edit')), [])

  // The exhibition text follows the opening image, in the flow of the page, so one scroll reads through it.
  const exhibitionText = view.textBelow && <div className="project-text-below"><PdfReader source={documents[0].href} label={work.title} /></div>
  const textAfterOpening = view.textBelow && images.some((image) => !image.group)
  const showTabs = !view.textBelow && documents.length > 0 && (view.hasImages || documents.length > 1)
  const pageClass = ['project-page', work.description.length > 900 && 'project-page-text', document && 'project-page-reading', view.article && 'project-page-article'].filter(Boolean).join(' ')

  return <main className={pageClass}>
    <aside className="project-navigation">
      <Identity tagline={false} />
      <nav aria-label="Portfolio navigation"><Link href="/" className="index-return">← Back to index</Link></nav>
      <div className="project project-info">
        <header>
          <h1>{work.title}</h1>
          <p>{[work.type, work.publication, longDate(work)].filter(Boolean).join(' · ')}</p>
        </header>
        <ProjectText description={work.description} links={view.links} />
        {showTabs && <nav className="project-media-tabs" aria-label="Project media">
          {view.hasImages && <button aria-pressed={documentIndex === null} onClick={() => setDocumentIndex(null)}>Images</button>}
          {documents.map((file, index) => (documents.length > 1 || documentIndex !== index) && <button key={file.href} aria-pressed={documentIndex === index} onClick={() => setDocumentIndex(index)}>
            {documents.length === 1 ? 'Read' : file.label.replace(/^Download\s+/i, '').replace(/\.pdf$/i, '') || 'Read'}
          </button>)}
        </nav>}
      </div>
    </aside>
    <section className="project-content" aria-label={`${work.title} media`}>
      {document && <PdfReader key={document.href} source={document.href} label={work.title} />}
      {view.article && <iframe className="article-frame" src={view.article} title={`${work.title} — ${work.publication}`} loading="lazy" referrerPolicy="no-referrer" sandbox={IFRAME_SANDBOX} />}
      {!document && <ProjectGallery work={work} images={images} labelled={labelled} afterOpening={textAfterOpening && exhibitionText} />}
      {!textAfterOpening && exhibitionText}
      {!document && view.relatedPages.map((link) => <section key={link.href} className="project-related">
        <h2><a href={link.href} target="_blank" rel="noreferrer">↳ {link.label}</a></h2>
        <iframe className="article-frame" src={link.href} title={link.label} loading="lazy" referrerPolicy="no-referrer" sandbox={IFRAME_SANDBOX} />
      </section>)}
      <nav className="project-return-bottom" aria-label="Return to index"><Link href="/" className="index-return">← Back to index</Link></nav>
    </section>
  </main>
}

// The index hover preview: title, details and one image.
export function ProjectPreview({ work, type = work.type }: { work: Work; type?: string }) {
  const images = useRandomOrder(work.images)
  const preview = images[0]?.src || work.featuredImage

  return <article className="project">
    <header>
      <h1>{work.indexTitle}</h1>
      <p>{[type, work.publication, work.date].filter(Boolean).join(' · ')}</p>
    </header>
    {preview && <div className="project-media">
      <Image src={mediaHref(preview)} alt={work.title} fill sizes="(max-width: 800px) 100vw, 30vw" priority />
    </div>}
  </article>
}

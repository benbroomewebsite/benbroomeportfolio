'use client'

import Image from 'next/image'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { aboutParagraphs, carouselImages, type Work, type WorkCategory, works } from '@/lib/works'
import mediaMap from '@/lib/media-map.json'

const filters: Array<'All' | WorkCategory> = ['All', 'Exhibition', 'Selected Writing', 'Performance', 'Talk', 'Artist Grant', 'Press']
const PdfReader = dynamic(() => import('@/components/pdf-reader'), {
  ssr: false,
  loading: () => <p className="pdf-status" role="status">Loading document reader…</p>,
})

function mediaHref(href: string) {
  const mediaBase = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL || 'https://pub-77bd6b0eb2e9483f9b0201fc3bb527e7.r2.dev').replace(/\/$/, '')
  const objectKey = (mediaMap as Record<string, string>)[href]
  return mediaBase && objectKey
    ? `${mediaBase}/${objectKey.split('/').map(encodeURIComponent).join('/')}`
    : href
}

export function Portfolio({ selectedSlug }: { selectedSlug?: string }) {
  const router = useRouter()
  const archiveRef = useRef<HTMLElement>(null)
  const selectedWork = selectedSlug ? works.find((work) => work.slug === selectedSlug) ?? null : null
  const [hovered, setHovered] = useState<Work | null>(null)
  const [filter, setFilter] = useState<'All' | WorkCategory>('All')
  const visibleWorks = filter === 'All' ? works : works.filter((work) => work.category === filter)
  const activeWork = selectedWork ?? hovered
  const expanded = Boolean(selectedWork && activeWork?.slug === selectedWork.slug)

  useLayoutEffect(() => {
    const savedScroll = window.sessionStorage.getItem('archive-scroll-top')
    if (savedScroll && archiveRef.current) archiveRef.current.scrollTop = Number(savedScroll)
    const savedFilter = window.sessionStorage.getItem('archive-filter')
    if (filters.includes(savedFilter as 'All' | WorkCategory)) setFilter(savedFilter as 'All' | WorkCategory)
  }, [])

  useEffect(() => {
    const closePreview = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setHovered(null)
        if (selectedSlug) router.push('/', { scroll: false })
      }
    }
    window.addEventListener('keydown', closePreview)
    return () => window.removeEventListener('keydown', closePreview)
  }, [router, selectedSlug])

  return <main className="site-shell">
    {!selectedSlug && <h1 className="sr-only">Ben Broome — Curator, writer and organiser</h1>}
    <section ref={archiveRef} className="archive" aria-label="Selected work">
      <header className="identity">
        <Link href="/" onMouseEnter={() => setHovered(null)}>
          <span>Ben Broome</span>
        </Link>
        <p>Curator, writer and organiser</p>
      </header>

      <nav className="filters" aria-label="Filter selected work">
        {filters.map((item) => <button key={item} className={filter === item ? 'active' : ''} aria-pressed={filter === item} onClick={() => {
          setFilter(item)
          window.sessionStorage.setItem('archive-filter', item)
        }}><span>{item}</span></button>)}
      </nav>

      <div className="work-list">
        {visibleWorks.map((work) => {
          const row = <>
            <span className="title"><span>{work.title}</span></span>
            <span><span>{work.publication}</span></span>
            <span><span>{work.date}</span></span>
            <span><span>{work.type}</span></span>
          </>

          if (work.category === 'Press' && work.externalHref) {
            return <a key={work.slug} href={work.externalHref} target="_blank" rel="noreferrer" className="work-row">{row}</a>
          }

          return <Link
            key={work.slug}
            href={`/work/${work.slug}`}
            scroll={false}
            className={`work-row${selectedWork?.slug === work.slug ? ' selected' : ''}`}
            aria-current={selectedWork?.slug === work.slug ? 'page' : undefined}
            onMouseEnter={() => setHovered(work)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(work)}
            onBlur={() => setHovered(null)}
            onClick={(event) => {
              event.preventDefault()
              setHovered(null)
              if (archiveRef.current) window.sessionStorage.setItem('archive-scroll-top', String(archiveRef.current.scrollTop))
              router.push(`/work/${work.slug}`, { scroll: false })
            }}
          >{row}</Link>
        })}
      </div>

      <footer className="contact">
        <a href="mailto:ben@drawingablank.com">ben@drawingablank.com</a><br />
        <a href="https://www.instagram.com/drabl" target="_blank" rel="noreferrer">↳ Instagram</a>
        <br />
        <Link href="/bio">↳ Bio</Link>
      </footer>
    </section>

    <section className="viewer" aria-live="polite">
      {activeWork
        ? <Project key={`${activeWork.slug}-${expanded ? 'full' : 'preview'}`} work={activeWork} expanded={expanded} />
        : <About />}
    </section>
  </main>
}

function About() {
  const [slide, setSlide] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const nextSlide = carouselImages.length ? (slide + 1) % carouselImages.length : 0

  useEffect(() => {
    if (carouselImages.length < 2 || transitioning) return
    const timer = window.setTimeout(() => setTransitioning(true), 2000)
    return () => window.clearTimeout(timer)
  }, [slide, transitioning])

  useEffect(() => {
    if (!transitioning) return
    const timer = window.setTimeout(() => {
      setSlide((current) => (current + 1) % carouselImages.length)
      setTransitioning(false)
    }, 650)
    return () => window.clearTimeout(timer)
  }, [transitioning])

  return <article className="about">
    <div className="about-copy">
      {aboutParagraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
    </div>
    {carouselImages.length > 0 && <button className="carousel" aria-label="Show next image" onClick={() => setTransitioning(true)}>
      <Image
        key={carouselImages[slide]}
        className={`carousel-current${transitioning ? ' leaving' : ''}`}
        src={mediaHref(carouselImages[slide])}
        alt=""
        fill
        sizes="(max-width: 800px) 100vw, 40vw"
        priority
      />
      {carouselImages.length > 1 && <Image
        key={carouselImages[nextSlide]}
        className={`carousel-next${transitioning ? ' entering' : ''}`}
        src={mediaHref(carouselImages[nextSlide])}
        alt=""
        fill
        sizes="(max-width: 800px) 100vw, 40vw"
        aria-hidden="true"
      />}
    </button>}
  </article>
}

function Project({ work, expanded }: { work: Work; expanded: boolean }) {
  const pdfs = work.files.filter((file) => /\.pdf(?:$|[?#])/i.test(file.href))
  const galleryImages = work.images.filter((image) => !/\.pdf$/i.test(image.originalName ?? ''))
  const pdfFirst = pdfs.length > 0 && (work.category === 'Selected Writing' || work.category === 'Talk' || galleryImages.length === 0)
  const [documentIndex, setDocumentIndex] = useState<number | null>(pdfFirst ? 0 : null)
  const document = expanded && documentIndex !== null ? pdfs[documentIndex] : undefined
  const showImages = galleryImages.length > 0 && !(pdfs.length > 0 && work.category === 'Selected Writing')
  const preview = galleryImages[0]
  const paragraphs = work.description ? work.description.split(/\n\n+/) : []
  const writingHref = work.files[0]?.href ? mediaHref(work.files[0].href) : work.externalHref
  const links = work.category === 'Selected Writing'
    ? (!pdfs.length && writingHref ? [{ label: 'Read', href: writingHref }] : [])
    : [
        ...work.files.filter((file) => !pdfs.includes(file)).map((file) => ({ label: file.label.replace(/\.pdf$/i, '') || 'File', href: mediaHref(file.href) })),
        ...(work.externalHref ? [{ label: 'Link', href: work.externalHref }] : []),
      ]

  return <article className={`project${expanded ? ' project-full' : ''}${document ? ' project-reading' : ''}`}>
    <header>
      <h1>{work.title}</h1>
      <p>{[work.type, work.publication, work.date].filter(Boolean).join(' · ')}</p>
    </header>
    {expanded && paragraphs.length > 0 && <div className="project-copy">
      {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
    </div>}
    {links.length > 0 && <div className="project-links">
      {links.map((link) => <a key={link.href} href={link.href} target={link.href.startsWith('/') ? undefined : '_blank'} rel={link.href.startsWith('/') ? undefined : 'noreferrer'}>↳ {link.label}</a>)}
    </div>}
    {!expanded && pdfFirst && <div className="project-links"><Link href={`/work/${work.slug}`} scroll={false}>↳ Read PDF</Link></div>}
    {expanded && pdfs.length > 0 && <nav className="project-media-tabs" aria-label="Project media">
      {showImages && <button aria-pressed={documentIndex === null} onClick={() => setDocumentIndex(null)}>Images</button>}
      {pdfs.map((file, index) => <button key={file.href} aria-pressed={documentIndex === index} onClick={() => setDocumentIndex(index)}>
        {work.category === 'Selected Writing' && pdfs.length === 1 ? 'PDF' : file.label.replace(/^Download\s+/i, '').replace(/\.pdf$/i, '') || 'PDF'}
      </button>)}
    </nav>}
    {document && <PdfReader key={document.href} source={document.href} label={work.title} />}
    {!expanded && !pdfFirst && preview && <div className="project-media">
      <Image src={mediaHref(preview.src)} alt={preview.alt} fill sizes="(max-width: 800px) 100vw, 40vw" priority />
    </div>}
    {expanded && !document && showImages && <div className="project-gallery">
      {[...new Set(galleryImages.map((image) => image.group ?? ''))].map((group) => <section className="gallery-group" key={group}>
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

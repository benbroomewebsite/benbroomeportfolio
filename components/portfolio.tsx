'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { carouselImages, carouselWork, contact, directHref, opensExternally, type Work, type WorkCategory, works } from '@/lib/works'
import { mediaHref } from '@/lib/media'
import { Identity } from '@/components/identity'
import { Project } from '@/components/project'

type Filter = 'All' | WorkCategory
type Slide = { src: string; work?: Work }

const filters: Filter[] = ['All', 'Exhibition', 'Selected Writing', 'Performance', 'Talk', 'Artist Grant']

// The slideshow follows the filter: the curated sequence for All, otherwise one
// image per project in that filter (every image for the grants, to show the
// recipients' work). Filters without images fall back to the curated sequence.
function slidesFor(filter: Filter): Slide[] {
  const curated = carouselImages.map((src) => ({ src, work: carouselWork(src) }))
  if (filter === 'All') return curated
  const slides = works.filter((work) => work.category === filter).flatMap((work) => {
    const lead = work.featuredImage || work.images[0]?.src
    const sources = filter === 'Artist Grant' ? work.images.map((image) => image.src) : lead ? [lead] : []
    return sources.map((src) => ({ src, work }))
  })
  return slides.length > 1 ? slides : curated
}

// The index names the venue without its city ("Goldsmiths CCA, London" → "Goldsmiths CCA");
// the project page keeps the full form.
const venueOnly = (venue: string) => venue.replace(/,\s*[^,]+$/, '')

export function Portfolio() {
  const archiveRef = useRef<HTMLElement>(null)
  const [hovered, setHovered] = useState<Work | null>(null)
  const [filter, setFilter] = useState<Filter>('All')
  const visibleWorks = filter === 'All' ? works : works.filter((work) => work.category === filter)

  useLayoutEffect(() => {
    const savedFilter = window.sessionStorage.getItem('archive-filter')
    if (filters.includes(savedFilter as Filter)) setFilter(savedFilter as Filter)
    const frame = requestAnimationFrame(() => {
      if (archiveRef.current) archiveRef.current.scrollTop = Number(window.sessionStorage.getItem('archive-scroll-top') ?? 0)
      window.scrollTo(0, Number(window.sessionStorage.getItem('archive-window-scroll') ?? 0))
    })
    // A saved position belongs to one return trip: it is dropped as soon as the
    // reader interacts again, so later visits start at the top.
    const forget = () => {
      window.sessionStorage.removeItem('archive-scroll-top')
      window.sessionStorage.removeItem('archive-window-scroll')
    }
    const events = ['pointerdown', 'wheel', 'keydown'] as const
    events.forEach((event) => window.addEventListener(event, forget, { once: true, passive: true }))
    return () => {
      cancelAnimationFrame(frame)
      events.forEach((event) => window.removeEventListener(event, forget))
    }
  }, [])

  const previewWork = (work: Work) => {
    if (window.matchMedia('(hover: hover) and (min-width: 801px)').matches) setHovered(work)
  }
  const savePosition = () => {
    if (archiveRef.current) window.sessionStorage.setItem('archive-scroll-top', String(archiveRef.current.scrollTop))
    window.sessionStorage.setItem('archive-window-scroll', String(window.scrollY))
  }

  return <main className="site-shell">
    <h1 className="sr-only">Ben Broome — Curator, writer and artist</h1>
    <section ref={archiveRef} className="archive" aria-label="Selected work">
      <div className="identity-mobile">
        <Identity />
        <Link href="/bio" className="identity-bio"><span>↳ Bio</span></Link>
      </div>

      <nav className="filters" aria-label="Filter selected work">
        {filters.map((item) => <button key={item} className={filter === item ? 'active' : ''} aria-pressed={filter === item} onClick={() => {
          setFilter(item)
          window.sessionStorage.setItem('archive-filter', item)
        }}><span>{item}</span></button>)}
      </nav>

      <div className="work-list">
        {visibleWorks.map((work) => {
          const row = <>
            <span className="title"><span>{work.indexTitle}</span></span>
            <span><span>{work.type}</span></span>
            <span><span>{venueOnly(work.publication)}</span></span>
            <span><span>{work.date}</span></span>
          </>
          const preview = {
            onMouseEnter: () => previewWork(work),
            onMouseLeave: () => setHovered(null),
            onFocus: () => previewWork(work),
            onBlur: () => setHovered(null),
          }

          if (opensExternally(work)) {
            return <a key={work.slug} href={work.externalHref!} target="_blank" rel="noreferrer" className="work-row" {...preview}>{row}</a>
          }

          return <Link key={work.slug} href={`/work/${work.slug}`} className="work-row" onClick={(event) => {
            const direct = directHref(work)
            if (direct && window.matchMedia('(max-width: 800px)').matches) {
              event.preventDefault()
              window.location.href = direct
              return
            }
            savePosition()
          }} {...preview}>{row}</Link>
        })}
      </div>

      <footer className="contact">
        <a href={`mailto:${contact.email}`}>{contact.email}</a><br />
        <a href={contact.instagram} target="_blank" rel="noreferrer">↳ Instagram</a>
        <br />
        <Link href="/bio">↳ Bio</Link>
      </footer>
    </section>

    <section className="viewer" aria-live="polite">
      <Identity className="identity-desktop" />
      {hovered
        ? <Project key={hovered.slug} work={hovered} />
        : <About key={filter} filter={filter} />}
    </section>
  </main>
}

function About({ filter }: { filter: Filter }) {
  const slides = useMemo(() => slidesFor(filter), [filter])
  const [slide, setSlide] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const nextSlide = (slide + 1) % slides.length
  const shown = slides[slide]?.work

  useEffect(() => {
    if (slides.length < 2 || transitioning) return
    const timer = window.setTimeout(() => setTransitioning(true), 2000)
    return () => window.clearTimeout(timer)
  }, [slide, slides.length, transitioning])

  useEffect(() => {
    if (!transitioning) return
    const timer = window.setTimeout(() => {
      setSlide((current) => (current + 1) % slides.length)
      setTransitioning(false)
    }, 650)
    return () => window.clearTimeout(timer)
  }, [slides.length, transitioning])

  return <article className="about">
    <div className="about-media">
      <button className="carousel" aria-label="Show next image" onClick={() => setTransitioning(true)}>
        <Image
          key={slides[slide].src}
          className={`carousel-current${transitioning ? ' leaving' : ''}`}
          src={mediaHref(slides[slide].src)}
          alt=""
          fill
          sizes="(max-width: 800px) 100vw, 30vw"
          priority
        />
        {slides.length > 1 && <Image
          key={`next-${slides[nextSlide].src}`}
          className={`carousel-next${transitioning ? ' entering' : ''}`}
          src={mediaHref(slides[nextSlide].src)}
          alt=""
          fill
          sizes="(max-width: 800px) 100vw, 30vw"
          aria-hidden="true"
        />}
      </button>
      {shown && <p className="carousel-caption"><Link href={`/work/${shown.slug}`}>{[shown.title, shown.publication, shown.date].filter(Boolean).join(' · ')}</Link></p>}
    </div>
  </article>
}

'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { aboutParagraphs, carouselImages, type Work, type WorkCategory, works } from '@/lib/works'
import { mediaHref } from '@/lib/media'
import { Project } from '@/components/project'

const filters: Array<'All' | WorkCategory> = ['All', 'Exhibition', 'Selected Writing', 'Performance', 'Talk', 'Artist Grant', 'Press']

export function Portfolio() {
  const archiveRef = useRef<HTMLElement>(null)
  const [hovered, setHovered] = useState<Work | null>(null)
  const [filter, setFilter] = useState<'All' | WorkCategory>('All')
  const visibleWorks = filter === 'All' ? works : works.filter((work) => work.category === filter)

  useLayoutEffect(() => {
    const savedFilter = window.sessionStorage.getItem('archive-filter')
    if (filters.includes(savedFilter as 'All' | WorkCategory)) setFilter(savedFilter as 'All' | WorkCategory)
    const frame = requestAnimationFrame(() => {
      if (archiveRef.current) archiveRef.current.scrollTop = Number(window.sessionStorage.getItem('archive-scroll-top') ?? 0)
      window.scrollTo(0, Number(window.sessionStorage.getItem('archive-window-scroll') ?? 0))
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  const previewWork = (work: Work) => {
    if (window.matchMedia('(hover: hover) and (min-width: 801px)').matches) setHovered(work)
  }
  const savePosition = () => {
    if (archiveRef.current) window.sessionStorage.setItem('archive-scroll-top', String(archiveRef.current.scrollTop))
    window.sessionStorage.setItem('archive-window-scroll', String(window.scrollY))
  }

  return <main className="site-shell">
    <h1 className="sr-only">Ben Broome — Curator, writer and organiser</h1>
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
            className="work-row"
            onMouseEnter={() => previewWork(work)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => previewWork(work)}
            onBlur={() => setHovered(null)}
            onClick={savePosition}
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
      {hovered
        ? <Project key={hovered.slug} work={hovered} expanded={false} />
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

import Link from 'next/link'
import type { Metadata } from 'next'
import { aboutParagraphs } from '@/lib/works'
import { Identity } from '@/components/identity'

export const metadata: Metadata = { title: 'Bio', description: aboutParagraphs.join(' '), alternates: { canonical: '/bio' }, openGraph: { title: 'Ben Broome — Bio', description: aboutParagraphs.join(' '), url: '/bio' } }

export default function BioPage() {
  return <main className="site-shell bio-shell">
    <h1 className="sr-only">Ben Broome — Biography</h1>
    <section className="archive" aria-label="Ben Broome">
      <Identity />

      <nav className="bio-return" aria-label="Portfolio navigation">
        <Link href="/">← Selected work</Link>
      </nav>

      <footer className="contact">
        <a href="mailto:ben@drawingablank.com">ben@drawingablank.com</a><br />
        <a href="https://www.instagram.com/drabl" target="_blank" rel="noreferrer">↳ Instagram</a>
      </footer>
    </section>

    <section className="viewer">
      <article className="bio-copy">
        {aboutParagraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </article>
    </section>
  </main>
}

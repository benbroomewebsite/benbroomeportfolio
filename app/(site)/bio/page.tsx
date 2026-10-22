import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { aboutParagraphs, contact, portrait } from '@/lib/bio'
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
        <a href={`mailto:${contact.email}`}>{contact.email}</a><br />
        <a href={contact.instagram} target="_blank" rel="noreferrer">↳ Instagram</a>
      </footer>
    </section>

    <section className="viewer">
      <article className="bio-copy">
        {portrait && <figure className="bio-portrait">
          <Image src={portrait.src} alt={portrait.alt} width={560} height={700} sizes="(max-width: 800px) 100vw, 40vw" />
          {portrait.credit && <figcaption>{portrait.credit}</figcaption>}
        </figure>}
        {aboutParagraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </article>
    </section>
  </main>
}

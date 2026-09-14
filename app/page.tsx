'use client'

import { useMemo, useState } from 'react'

type Category = 'All' | 'Exhibition' | 'Selected Writing' | 'Performance' | 'Artist Grant' | 'Press'

type Work = {
  title: string
  venue: string
  place: string
  year: string
  category: Exclude<Category, 'All'>
  kind: string
  description: string
  image: string
  alt: string
}

const works: Work[] = [
  {
    title: 'Spatial Semiology',
    venue: 'Giseok Kim',
    place: 'Seoul, South Korea',
    year: '2025',
    category: 'Exhibition',
    kind: 'Exhibition design',
    description: 'An exhibition identity and spatial programme considering architecture as a living system of signs, thresholds, and encounters.',
    image: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-GVAIrwoKGm7hBMRC6Q631gqP7Tro7P.png',
    alt: 'Brick arched building set among dense green trees',
  },
  {
    title: 'Venice Biennale Korean Pavilion',
    venue: 'La Biennale di Venezia',
    place: 'Venice, Italy',
    year: '2025',
    category: 'Exhibition',
    kind: 'Exhibition design',
    description: 'A visual and spatial language for the Korean Pavilion at the 19th International Architecture Exhibition.',
    image: 'https://images.unsplash.com/photo-1549490349-8643362247b5?auto=format&fit=crop&w=1800&q=85',
    alt: 'Abstract warm-toned artwork',
  },
  {
    title: 'The Making of Husbands',
    venue: 'Christina Ramberg in Dialogue',
    place: 'Chicago, United States',
    year: '2024',
    category: 'Selected Writing',
    kind: 'Essay',
    description: 'A critical essay on the body, domesticity, and the strange visual grammar of becoming a self in public.',
    image: 'https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=1800&q=85',
    alt: 'Sculpture in a quiet gallery',
  },
  {
    title: 'Auge',
    venue: 'Independent publication',
    place: 'Antwerp, Belgium',
    year: '2024',
    category: 'Press',
    kind: 'Publication',
    description: 'Research, editing, and image direction for a small-format publication on looking, scale, and material memory.',
    image: 'https://images.unsplash.com/photo-1564399579883-451a5d44ec08?auto=format&fit=crop&w=1800&q=85',
    alt: 'Open book and printed matter on a table',
  },
  {
    title: 'House of Presence',
    venue: 'INSIDE Graduation Show',
    place: 'The Hague, Netherlands',
    year: '2024',
    category: 'Exhibition',
    kind: 'Spatial direction',
    description: 'A graduation exhibition shaped around the house as an unstable container for individual and collective presence.',
    image: 'https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=1800&q=85',
    alt: 'Visitors moving through a contemporary exhibition space',
  },
  {
    title: 'Work Rosters v2',
    venue: 'Tact',
    place: 'Busan, South Korea',
    year: '2023',
    category: 'Artist Grant',
    kind: 'Research project',
    description: 'An ongoing visual research project mapping how creative labour is organized, named, and made visible.',
    image: 'https://images.unsplash.com/photo-1551913902-c92207136625?auto=format&fit=crop&w=1800&q=85',
    alt: 'Bright red and blue abstract architectural structure',
  },
  {
    title: 'Book and Space',
    venue: 'Urbanlike Presents',
    place: 'Seoul, South Korea',
    year: '2023',
    category: 'Performance',
    kind: 'Public programme',
    description: 'A reading room and live programme investigating how books can become temporary architectures for gathering.',
    image: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1800&q=85',
    alt: 'Bookshelves in a warm library',
  },
  {
    title: 'An Angel’s Share',
    venue: 'Collectible New York',
    place: 'New York, United States',
    year: '2024',
    category: 'Exhibition',
    kind: 'Installation',
    description: 'An installation about residue, exchange, and the small amount of a thing that remains after it has been shared.',
    image: 'https://images.unsplash.com/photo-1551913902-c92207136625?auto=format&fit=crop&w=1800&q=85',
    alt: 'Geometric installation with saturated primary colors',
  },
  {
    title: 'Mental Health and Art',
    venue: 'Art Monthly',
    place: 'London, United Kingdom',
    year: '2021',
    category: 'Selected Writing',
    kind: 'Feature',
    description: 'A conversation about care, representation, and the institutional conditions around art and mental health.',
    image: 'https://images.unsplash.com/photo-1577083552431-6e5fd01988b5?auto=format&fit=crop&w=1800&q=85',
    alt: 'Colorful contemporary painting in a gallery',
  },
  {
    title: 'Reading Pleasure',
    venue: 'Cell Project Space',
    place: 'London, United Kingdom',
    year: '2017',
    category: 'Performance',
    kind: 'Public programme',
    description: 'A programme of readings, scores, and informal encounters that treats attention as a shared physical practice.',
    image: 'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=1800&q=85',
    alt: 'Minimal reading desk with a chair and lamp',
  },
]

const categories: Category[] = ['All', 'Exhibition', 'Selected Writing', 'Performance', 'Artist Grant', 'Press']

export default function Page() {
  const [activeCategory, setActiveCategory] = useState<Category>('All')
  const [selected, setSelected] = useState(0)
  const filteredWorks = useMemo(() => activeCategory === 'All' ? works : works.filter((work) => work.category === activeCategory), [activeCategory])
  const selectedWork = works[selected]

  function changeCategory(category: Category) {
    setActiveCategory(category)
    const nextIndex = works.findIndex((work) => category === 'All' || work.category === category)
    setSelected(nextIndex < 0 ? 0 : nextIndex)
  }

  return (
    <main className="site-shell">
      <aside className="index-rail">
        <header className="site-header">
          <a className="monogram" href="#top" aria-label="Index home">↳</a>
          <div>
            <p className="site-name">Ben Broome</p>
            <p className="site-role">Curator, writer, and organiser</p>
          </div>
        </header>

        <nav className="category-nav" aria-label="Work categories">
          {categories.map((category) => (
            <button
              className={activeCategory === category ? 'category-button active' : 'category-button'}
              key={category}
              type="button"
              onClick={() => changeCategory(category)}
            >
              {category}
            </button>
          ))}
        </nav>

        <div className="work-list" aria-label="Selected work">
          {filteredWorks.map((work) => {
            const workIndex = works.indexOf(work)
            return (
              <button
                className={selected === workIndex ? 'work-row selected' : 'work-row'}
                key={`${work.title}-${work.year}`}
                type="button"
                onClick={() => setSelected(workIndex)}
              >
                <span className="work-title">{work.title}</span>
                <span className="work-meta">{work.venue}</span>
                <span className="work-year">{work.year}</span>
              </button>
            )
          })}
        </div>

        <footer className="rail-footer">
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
          <span>© 2025</span>
        </footer>
      </aside>

      <section className="detail-panel" id="top" aria-label="Selected project">
        <div className="detail-topline">
          <span>Selected work / {String(selected + 1).padStart(2, '0')}</span>
          <span>{selectedWork.category}</span>
        </div>
        <div className="detail-copy">
          <p className="detail-kicker">{selectedWork.kind}</p>
          <h1>{selectedWork.title}</h1>
          <p className="detail-description">{selectedWork.description}</p>
          <p className="detail-location">{selectedWork.venue}<br />{selectedWork.place} · {selectedWork.year}</p>
        </div>
        <figure className="detail-image-wrap">
          <img src={selectedWork.image} alt={selectedWork.alt} className="detail-image" />
          <figcaption>{selectedWork.title} — {selectedWork.place}, {selectedWork.year}</figcaption>
        </figure>
        <div className="detail-footer" id="about">
          <p>Independent practice across exhibitions, publications, and public programmes. Working with artists, institutions, and ideas in motion.</p>
          <a id="contact" href="mailto:studio@benbroome.co.uk">studio@benbroome.co.uk ↗</a>
        </div>
      </section>
    </main>
  )
}

'use client'

import { useMemo, useState } from 'react'

type Entry = { title: string; publication: string; date: string; type: string }
const entries: Entry[] = [
  { title: 'Donald Rodney, Visceral Canker', publication: 'Art Monthly', date: 'Jul 2024', type: 'Review' },
  { title: 'Exhibition as Image', publication: 'Art Monthly', date: 'Jan 2022', type: 'Review' },
  { title: 'Rosa-Johan Uddoh', publication: 'Artforum', date: 'Dec 2021', type: 'Review' },
  { title: 'Mental Health and Art', publication: 'Art Monthly', date: 'May 2021', type: 'Report' },
  { title: 'Manifesta 13 Marseille', publication: 'Art Monthly', date: 'Nov 2020', type: 'Review' },
  { title: 'Richard Sides', publication: 'Artforum', date: 'Jan 2020', type: 'Review' },
  { title: 'Mathieu Copeland & Stewart Home', publication: 'Cell Project Space', date: 'Sep 2019', type: 'Public Programme' },
  { title: 'Shit and Doom - N0lart', publication: 'Cell Project Space', date: 'Sep 2019', type: 'Exhibition' },
  { title: 'The Making of Husbands: Christina Ramberg in Dialogue', publication: 'Mousse', date: 'Dec 2019', type: 'Review' },
  { title: 'Anna-Sophie Berger, A Failed Play', publication: 'Cell Project Space', date: 'Apr 2019', type: 'Exhibition' },
  { title: 'Diamond Stingily, Ser Serpas, Lydia Ourahmane', publication: 'Art Monthly', date: 'Jun 2019', type: 'Review' },
  { title: 'Rosa Aiello and Patricia L. Boyd, Joins', publication: 'Cell Project Space', date: 'Feb 2019', type: 'Exhibition' },
  { title: 'Cady Noland', publication: 'Art Monthly', date: 'Feb 2019', type: 'Review' },
  { title: 'Alan Michael, Astrology and the City', publication: 'Cell Project Space', date: 'Sep 2018', type: 'Exhibition' },
  { title: 'Angharad Williams and Mathis Gasser, Hergest: Nant', publication: 'Cell Project Space', date: 'Apr 2018', type: 'Exhibition' },
  { title: 'Partners by Ghislaine Leung', publication: 'Cell Project Space', date: 'Feb 2018', type: 'Edited Publication' },
  { title: 'Jenna Bliss and Gili Tal, Step into Spring', publication: 'Cell Project Space', date: 'Jun 2017', type: 'Exhibition' },
  { title: 'Reading Pleasure', publication: 'Cell Project Space', date: 'May 2017', type: 'Public Programme' },
  { title: 'Jenna Bliss', publication: 'Art Monthly', date: 'Apr 2017', type: 'Feature' },
  { title: 'Perverts', publication: 'Cell Project Space', date: 'Apr 2017', type: 'Exhibition' },
  { title: 'Ghislaine Leung, The Moves', publication: 'Cell Project Space', date: 'Feb 2017', type: 'Exhibition' },
  { title: 'Schizophrenic Walks', publication: 'Plymouth College of Art', date: 'Jan 2017', type: 'Exhibition Essay' },
  { title: 'Marc Camille Chaimowicz and Bruno Pélassy', publication: 'Art Monthly', date: 'Aug 2016', type: 'Review' },
]
const filters = ['All', 'Exhibition', 'Selected Writing', 'Performance', 'Artist Grant', 'Press']

export default function Page() {
  const [filter, setFilter] = useState('All')
  const [selected, setSelected] = useState(entries[0])
  const visible = useMemo(() => filter === 'All' ? entries : entries.filter((entry) => filter === 'Selected Writing' ? ['Review', 'Report', 'Feature', 'Edited Publication', 'Exhibition Essay'].includes(entry.type) : entry.type === filter), [filter])

  return <main className="site-shell">
    <aside className="left-rail">
      <div>
        <button className="name" onClick={() => setFilter('All')}>Ben Broome</button>
        <p className="intro">Curator, writer and organiser</p>
      </div>
      <div className="left-bottom"><p>Selected work<br />2016—2024</p><p><a href="mailto:ben@benbroome.co.uk">ben@benbroome.co.uk</a></p></div>
    </aside>
    <section className="right-panel" aria-label="Selected work">
      <nav className="filter-nav" aria-label="Archive filters">{filters.map((item) => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</nav>
      <div className="archive-list">{visible.map((entry) => <button key={`${entry.title}-${entry.date}`} className="archive-row" onClick={() => setSelected(entry)}><span>{entry.title}</span><span>{entry.publication}</span><span>{entry.date}</span><span>{entry.type}</span></button>)}</div>
      <article className="detail"><p>Selected record</p><h1>{selected.title}</h1><p>{selected.publication} · {selected.date} · {selected.type}</p></article>
    </section>
  </main>
}

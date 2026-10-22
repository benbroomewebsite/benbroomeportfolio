import type { ReactNode } from 'react'
import type { WorkLink } from '@/lib/works'

// A project's text and the links beneath it, in the page's left column.

// Names in the text that have a link of their own (grant recipients, judges)
// become that link, once each, and drop out of the list of links below.
function linkNames(paragraphs: string[], links: WorkLink[]) {
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

// Artist grant texts mark their sections with lines like "The Judging Panel:" and
// "WINNERS:"; these become headings, and each winner's name line a subheading.
const isSectionLabel = (text: string) => /^[^.!?]{1,40}[:;]$/.test(text)
const isWinnersLabel = (text: string) => /^winners?[:;]?$/i.test(text)
const isNameLine = (text: string) => text.split(/\s+/).length <= 5 && !/[.!?:;,]$/.test(text)
function sectionTitle(text: string) {
  const title = text.slice(0, -1).trim()
  return title === title.toUpperCase() ? title.charAt(0) + title.slice(1).toLowerCase() : title
}

export function ProjectText({ description, links }: { description: string; links: WorkLink[] }) {
  const paragraphs = description ? description.split(/\n\n+/).map((paragraph) => paragraph.trim()) : []
  const { linked, remaining } = linkNames(paragraphs, links)
  const winnersFrom = paragraphs.findIndex(isWinnersLabel)

  return <>
    {paragraphs.length > 0 && <div className="project-copy">
      {paragraphs.map((text, index) => {
        if (isSectionLabel(text)) return <h2 key={index} className={`project-copy-heading${index > 0 ? ' project-copy-break' : ''}`}>{sectionTitle(text)}</h2>
        if (winnersFrom >= 0 && index > winnersFrom && isNameLine(text)) return <h3 key={index} className="project-copy-name">{linked[index]}</h3>
        return <p key={index}>{linked[index]}</p>
      })}
    </div>}
    {remaining.length > 0 && <div className="project-links">
      {remaining.map((link) => {
        const external = !link.href.startsWith('/')
        return <a key={link.href} href={link.href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>↳ {link.label}</a>
      })}
    </div>}
  </>
}

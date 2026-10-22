// Checks the projects as the site sees them, and the rules for what a project
// page shows. Runs before every build; content problems the editor can cause are
// handled (with warnings) by build-works.mjs, so a failure here is a code bug.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
require('node:child_process').execFileSync(process.execPath, [path.resolve(__dirname, 'build-works.mjs')], { stdio: 'inherit' })
require('./lib/register-ts.cjs')
const { inFilter, typeIn, works } = require('../lib/works.ts')
const { projectView } = require('../lib/project-view.ts')
const media = require('../lib/media-map.json')

const resolves = (src) => /^https:\/\//.test(src) || media[src] || fs.existsSync(path.resolve(__dirname, '../public', `.${src}`))

// Every project.
const addresses = works.flatMap((work) => [work.slug, ...(work.legacySlug ? [work.legacySlug] : [])])
assert.equal(new Set(addresses).size, addresses.length, 'Two projects share a page address')
for (const work of works) {
  assert.ok(work.title, `Missing title: ${work.slug}`)
  assert.ok(work.year >= 2000, `Date must be YYYY, YYYY-MM or YYYY-MM-DD: ${work.slug}`)
  if (work.sortDate) {
    const day = work.sortDate.length === 7 ? `${work.sortDate}-01` : work.sortDate
    assert.equal(new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10), day, `Invalid date for ${work.slug}`)
    assert.equal(work.year, Number(work.sortDate.slice(0, 4)))
    assert.match(work.date, /^[A-Z][a-z]{2} \d{4}$/, `Index date should read like "Sep 2025": ${work.slug}`)
  }
  for (const item of [...work.images, ...work.videos, ...work.files]) {
    assert.ok(resolves(item.src ?? item.href), `Missing media: ${item.src ?? item.href}`)
  }
  for (const link of work.links) assert.match(new URL(link.href).protocol, /^https?:$/)
}

// Newest first within each year, with year-only projects after the dated ones.
for (const year of new Set(works.map((work) => work.year))) {
  const inYear = works.filter((work) => work.year === year)
  const dated = inYear.filter((work) => work.sortDate)
  assert.deepEqual(dated.map((work) => work.sortDate), dated.map((work) => work.sortDate).sort().reverse())
  assert.ok(inYear.slice(0, dated.length).every((work) => work.sortDate), `Year-only entry interrupts ${year}`)
}

// What a project page shows.
const project = (overrides) => ({
  slug: 'test', title: 'Test', indexTitle: 'Test', type: '', publication: '', date: '2025', month: '', year: 2025,
  description: '', images: [], imageOrder: 'random', videos: [], files: [], links: [], externalHref: null,
  featuredImage: '', order: 0, category: 'Exhibition', alsoInWriting: false, hiddenFromAll: false, ...overrides,
})
const photo = { src: '/a.jpg', alt: '', width: 1600, height: 1000 }
const pdf = (label, display = 'inline') => ({ label, href: `/${label}.pdf`, display })
const labels = (work) => projectView(work).links.map((link) => link.label)

const exhibition = project({ images: [photo], files: [pdf('Exhibition text')], links: [{ label: 'Press: The Guardian', href: 'https://example.com/' }] })
assert.equal(projectView(exhibition).textBelow, true, 'An exhibition text is read beneath the opening image')
assert.deepEqual(labels(exhibition), ['Press: The Guardian', 'Exhibition text'], 'and linked after the press')
const pressRelease = project({ images: [photo], files: [pdf('Press release', 'link')] })
assert.deepEqual(projectView(pressRelease).documents, [], 'A document set to link is not read on the page')
assert.deepEqual(labels(pressRelease), ['Press release'])
const article = project({ category: 'Selected Writing', images: [photo], publication: 'Frieze', externalHref: 'https://www.frieze.com/article/x' })
assert.deepEqual(labels(article), ['Read on Frieze'], 'Writing published elsewhere links to it by name')
assert.equal(projectView(article).article, undefined, 'Frieze refuses to be shown inside another site')
const talk = project({ category: 'Talk', files: [pdf('Transcript')] })
assert.equal(projectView(talk).opensOnDocument, true)
assert.deepEqual(labels(talk), [], 'A talk is read on the page, not linked as well')

// Which lists a project appears in.
const exhibitionText = project({ alsoInWriting: true })
assert.ok(inFilter(exhibitionText, 'All') && inFilter(exhibitionText, 'Exhibition') && inFilter(exhibitionText, 'Selected Writing'))
assert.equal(typeIn(exhibitionText, 'Selected Writing'), 'Exhibition text')
const linkedInterview = project({ category: 'Selected Writing', hiddenFromAll: true })
assert.ok(!inFilter(linkedInterview, 'All') && inFilter(linkedInterview, 'Selected Writing'), 'A piece left out of All stays under its own filter')

console.log(JSON.stringify({
  projects: works.length,
  unresolvedDates: works.filter((work) => !work.sortDate).length,
  assertions: 'passed',
}))

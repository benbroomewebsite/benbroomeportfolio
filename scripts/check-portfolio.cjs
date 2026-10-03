const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const assert = require('node:assert/strict')
const ts = require('typescript')

// Exercise the actual normalization/sorting, including the imported archive.
const filename = path.resolve(__dirname, '../lib/works.ts')
const compiled = new Module(filename, module)
compiled.filename = filename
compiled.paths = module.paths
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename)

const { works } = compiled.exports
const media = require('../lib/media-map.json')
const dates = require('../lib/date-research.json')
assert.equal(new Set(works.map((work) => work.slug)).size, works.length, 'Duplicate project URLs')

for (const work of works) {
  if (work.sortDate) {
    assert.match(work.sortDate, /^\d{4}-\d{2}(?:-\d{2})?$/)
    const date = work.sortDate.length === 7 ? `${work.sortDate}-01` : work.sortDate
    assert.equal(new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10), date, `Invalid date for ${work.slug}`)
    assert.equal(work.year, Number(work.sortDate.slice(0, 4)))
    assert.match(work.date, /^[A-Z][a-z]{2,3} \d{4}$/)
  }
  for (const file of work.files) {
    if (file.href.startsWith('/')) assert.ok(media[file.href], `Unregistered document: ${file.href}`)
  }
  for (const item of [...work.images, ...(work.videos ?? [])]) {
    assert.ok(media[item.src], `Unregistered media: ${item.src}`)
  }
  for (const link of work.links) {
    assert.ok(link.label)
    assert.match(new URL(link.href).protocol, /^https?:$/)
  }
}

for (const year of new Set(works.map((work) => work.year))) {
  const inYear = works.filter((work) => work.year === year)
  const dated = inYear.filter((work) => work.sortDate)
  assert.deepEqual(dated.map((work) => work.sortDate), dated.map((work) => work.sortDate).sort().reverse())
  assert.ok(inYear.slice(0, dated.length).every((work) => work.sortDate), `Year-only entry interrupts ${year}`)
}

for (const [slug, research] of Object.entries(dates)) {
  const work = works.find((entry) => entry.slug === slug || entry.legacySlug === slug)
  assert.equal(work?.sortDate, research.sortDate)
  assert.ok(research.sources.length > 0 && research.note, `Missing provenance: ${slug}`)
}

const london = works.find((work) => work.slug === 'drawing-a-blank-parasol-unit-1')
assert.equal(london.year, 2019)
assert.equal(london.publication, 'London')
assert.ok(works.some((work) => work.slug === 'drawing-a-blank-parasol-unit'))
assert.equal(works.find((work) => work.slug === 'exhibition-lenard-giller-revisions').files[0].href, '/files/Revisions-press-release.pdf')
assert.equal(works.find((work) => work.slug === 'exhibition-ladjidiaby').files.length, 0)

console.log(JSON.stringify({
  projects: works.length,
  researchedDates: Object.keys(dates).length,
  unresolved: works.filter((work) => work.category !== 'Press' && !work.sortDate).length,
  assertions: 'passed',
}))

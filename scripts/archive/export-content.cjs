// One-off migration: writes one editable file per project into content/works/
// from the imported archive plus its researched dates, resources and image sizes.
// Running it again overwrites edits made in the editor, so it refuses to unless
// passed --force.
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

const out = path.resolve(__dirname, '../../content/works')
if (fs.existsSync(out) && !process.argv.includes('--force')) {
  console.error('content/works already exists. Pass --force to overwrite it.')
  process.exit(1)
}

const filename = path.resolve(__dirname, 'legacy-works.ts')
const compiled = new Module(filename, module)
compiled.filename = filename
compiled.paths = module.paths
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename)

fs.mkdirSync(out, { recursive: true })
for (const work of compiled.exports.works) {
  const entry = {
    title: work.title,
    category: work.category,
    type: work.type,
    publication: work.publication,
    date: work.sortDate ?? (work.year ? String(work.year) : ''),
    description: work.description,
    externalHref: work.externalHref ?? '',
    links: work.links,
    files: work.files,
    featuredImage: work.featuredImage,
    images: work.images.map((image) => ({
      src: image.src, alt: image.alt, group: image.group ?? '',
      width: image.width ?? null, height: image.height ?? null, originalName: image.originalName ?? '',
    })),
    videos: (work.videos ?? []).map((video) => ({ src: video.src, label: video.label, group: video.group ?? '' })),
    legacySlug: work.legacySlug ?? '',
    order: work.order,
  }
  fs.writeFileSync(path.join(out, `${work.slug}.json`), `${JSON.stringify(entry, null, 2)}\n`)
}
console.log(`Wrote ${compiled.exports.works.length} projects to content/works`)

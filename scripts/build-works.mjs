// Collects the per-project files in content/works into one generated file the
// site imports. Runs before dev, build and check; do not edit the output.
//
// Whatever the editor saves must still build: a failed build leaves the live
// site on its previous version without telling the editor why. So a broken
// reference (a mistyped image path, a link without an address) is left out
// with a warning in the build log, rather than stopping the build.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { imageSize } = require('next/dist/compiled/image-size')
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const media = JSON.parse(readFileSync(join(root, 'lib/media-map.json'), 'utf8'))
const DATE = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/

const warnings = []
const warn = (slug, message) => warnings.push(`${slug}: ${message}`)

// A path is usable when it is a web address, an object in the media bucket or a
// file the site serves from public/.
const inPublic = (path) => path.startsWith('/') && !path.includes('..') && existsSync(join(root, 'public', path))
const resolves = (path) => /^https:\/\//.test(path) || Boolean(media[path]) || inPublic(path)
const isWebAddress = (href) => {
  try {
    return ['http:', 'https:'].includes(new URL(href).protocol)
  } catch {
    return false
  }
}

function keepResolvable(slug, items, pathOf, kind) {
  return (items ?? []).filter((item) => {
    const path = pathOf(item)
    if (!path || resolves(path)) return true
    warn(slug, `${kind} not found, left out: ${path}`)
    return false
  })
}

// Images uploaded through the editor arrive without dimensions, which the
// gallery layout needs, so they are read from the file.
function measure(image) {
  if (!image.upload || !inPublic(image.upload)) return image
  const { width, height, orientation } = imageSize(readFileSync(join(root, 'public', image.upload)))
  // Phone photos can be stored on their side with a note to rotate them.
  const turned = orientation >= 5
  return { ...image, width: turned ? height : width, height: turned ? width : height }
}

function collect(name) {
  const slug = name.replace(/\.json$/, '')
  const work = { slug, ...JSON.parse(readFileSync(join(root, 'content/works', name), 'utf8')) }
  if (work.category !== 'Press' && !DATE.test(work.date ?? '')) {
    warn(slug, `left off the site until it has a date (2025, 2025-10 or 2025-10-04), found "${work.date ?? ''}"`)
    return undefined
  }
  return {
    ...work,
    images: keepResolvable(slug, work.images, (image) => image.upload || image.src, 'image').map(measure),
    videos: keepResolvable(slug, work.videos, (video) => video.src, 'video'),
    files: keepResolvable(slug, work.files, (file) => file.upload || file.href, 'document'),
    links: (work.links ?? []).filter((link) => {
      if (link.label && isWebAddress(link.href)) return true
      if (link.label || link.href) warn(slug, `link needs a label and an address starting https://, left out: ${link.label || link.href}`)
      return false
    }),
  }
}

const works = readdirSync(join(root, 'content/works')).filter((name) => name.endsWith('.json')).sort().map(collect).filter(Boolean)

mkdirSync(join(root, 'lib/generated'), { recursive: true })
copyFileSync(join(root, 'content/site.json'), join(root, 'lib/generated/site.json'))
writeFileSync(join(root, 'lib/generated/works.json'), JSON.stringify(works))
console.log(`Collected ${works.length} projects`)
for (const warning of warnings) console.warn(`  Warning: ${warning}`)

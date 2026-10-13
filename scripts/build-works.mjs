// Collects the per-project files in content/works into one generated file the
// site imports. Runs before dev, build and check; do not edit the output.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const { imageSize } = createRequire(import.meta.url)('next/dist/compiled/image-size')

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'content/works')
const works = readdirSync(source)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => ({ slug: name.replace(/\.json$/, ''), ...JSON.parse(readFileSync(join(source, name), 'utf8')) }))

// Images uploaded through the editor arrive without dimensions, which the
// gallery layout needs, so they are read from the file here.
for (const work of works) {
  for (const image of work.images ?? []) {
    const file = image.upload && join(root, 'public', image.upload)
    if (!file || !existsSync(file)) continue
    const { width, height, orientation } = imageSize(readFileSync(file))
    // Phone photos can be stored on their side with a note to rotate them.
    const turned = orientation >= 5
    image.width = turned ? height : width
    image.height = turned ? width : height
  }
}

mkdirSync(join(root, 'lib/generated'), { recursive: true })
copyFileSync(join(root, 'content/site.json'), join(root, 'lib/generated/site.json'))
writeFileSync(join(root, 'lib/generated/works.json'), JSON.stringify(works))
console.log(`Collected ${works.length} projects`)

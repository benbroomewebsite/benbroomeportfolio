// Collects the per-project files in content/works into one generated file the
// site imports. Runs before dev, build and check; do not edit the output.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'content/works')
const works = readdirSync(source)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => ({ slug: name.replace(/\.json$/, ''), ...JSON.parse(readFileSync(join(source, name), 'utf8')) }))

mkdirSync(join(root, 'lib/generated'), { recursive: true })
writeFileSync(join(root, 'lib/generated/works.json'), JSON.stringify(works))
console.log(`Collected ${works.length} projects`)

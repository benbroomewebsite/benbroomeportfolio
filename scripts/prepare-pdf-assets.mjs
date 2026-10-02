import { cp, mkdir, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const fromReactPdf = createRequire(require.resolve('react-pdf'))
const packagePath = fromReactPdf.resolve('pdfjs-dist/package.json')
const { version } = JSON.parse(await readFile(packagePath, 'utf8'))
const source = dirname(packagePath)
const destination = join(process.cwd(), 'public', 'pdfjs', version)
await mkdir(destination, { recursive: true })
await cp(join(source, 'build', 'pdf.worker.min.mjs'), join(destination, 'pdf.worker.min.mjs'))
for (const directory of ['cmaps', 'standard_fonts', 'wasm']) {
  await cp(join(source, directory), join(destination, directory), { recursive: true })
}

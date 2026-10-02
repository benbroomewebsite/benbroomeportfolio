'use client'

import { useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

const assetBase = `/pdfjs/${pdfjs.version}`
pdfjs.GlobalWorkerOptions.workerSrc = `${assetBase}/pdf.worker.min.mjs`
const options = {
  cMapUrl: `${assetBase}/cmaps/`,
  standardFontDataUrl: `${assetBase}/standard_fonts/`,
  wasmUrl: `${assetBase}/wasm/`,
  disableAutoFetch: true,
  disableStream: true,
  rangeChunkSize: 1024 * 1024,
}

export default function PdfReader({ source, label }: { source: string; label: string }) {
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)
  const [pages, setPages] = useState(0)
  const [error, setError] = useState(false)
  const documentUrl = `/api/document?src=${encodeURIComponent(source)}`

  useEffect(() => {
    if (!scrollRoot) return
    const resize = new ResizeObserver(([entry]) => setWidth(Math.max(1, Math.floor(entry.contentRect.width))))
    resize.observe(scrollRoot)
    return () => resize.disconnect()
  }, [scrollRoot])

  return <section className="pdf-reader" aria-label={`${label} PDF reader`}>
    <div className="pdf-toolbar">
      <span aria-live="polite">{pages ? `${pages} ${pages === 1 ? 'page' : 'pages'}` : 'PDF'}</span>
      <a href={`${documentUrl}&download=1`}>Download</a>
    </div>
    <div className="pdf-pages" ref={setScrollRoot} tabIndex={0} aria-label="Document pages">
      {error ? <p className="pdf-status" role="alert">This PDF could not be displayed. <a href={documentUrl} target="_blank" rel="noreferrer">Open the PDF</a></p> : <Document
        file={documentUrl}
        options={options}
        suspense={false}
        loading={<p className="pdf-status" role="status">Loading document…</p>}
        onLoadSuccess={({ numPages }) => setPages(numPages)}
        onLoadError={() => setError(true)}
        externalLinkTarget="_blank"
      >
        {width > 0 && Array.from({ length: pages }, (_, index) => <ReaderPage
          key={index + 1}
          number={index + 1}
          width={width}
          root={scrollRoot}
        />)}
      </Document>}
    </div>
  </section>
}

function ReaderPage({ number, width, root }: { number: number; width: number; root: HTMLDivElement | null }) {
  const element = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(number === 1)
  const [ratio, setRatio] = useState(Math.SQRT2)

  useEffect(() => {
    if (!element.current || !root) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { root, rootMargin: '600px 0px' })
    observer.observe(element.current)
    return () => observer.disconnect()
  }, [root])

  return <div ref={element} className="pdf-page" style={{ width, minHeight: Math.round(width * ratio) }} aria-label={`Page ${number}`}>
    {visible && <Page
      pageNumber={number}
      width={width}
      suspense={false}
      devicePixelRatio={Math.min(window.devicePixelRatio || 1, 2)}
      onLoadSuccess={(page) => {
        const viewport = page.getViewport({ scale: 1 })
        setRatio(viewport.height / viewport.width)
      }}
      loading={<p className="pdf-status" role="status">Loading page {number}…</p>}
      error={<p className="pdf-status">Page {number} could not be displayed.</p>}
    />}
  </div>
}

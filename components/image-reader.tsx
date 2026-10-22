'use client'

import Image from 'next/image'
import { useEffect, useRef } from 'react'
import { mediaHref } from '@/lib/media'
import type { WorkImage } from '@/lib/works'

// A scanned text read full size over the blurred page. The native dialog gives
// Escape to close and keeps keyboard focus inside while it is open.
export function ImageReader({ images, label, open, onClose }: { images: WorkImage[]; label: string; open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])

  return <dialog ref={dialog} className="image-reader" aria-label={label} onClose={onClose}
    // A click on the blurred space around the pages closes the reader.
    onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <button type="button" className="image-reader-close" aria-label="Close" onClick={onClose}>×</button>
    <div className="image-reader-pages" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      {images.map((image) => <Image key={image.src} src={mediaHref(image.src)} alt={image.alt} width={image.width ?? 1500} height={image.height ?? 2000} sizes="(max-width: 800px) 100vw, 900px" />)}
    </div>
  </dialog>
}

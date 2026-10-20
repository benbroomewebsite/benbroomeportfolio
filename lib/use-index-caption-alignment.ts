'use client'

import { useLayoutEffect, type RefObject } from 'react'

// A desktop index can end part way through a row. Keep its caption on the last
// complete text line, including the contact links when scrolled to the end.
export function useIndexCaptionAlignment(archiveRef: RefObject<HTMLElement | null>, filter: string, previewing: boolean) {
  useLayoutEffect(() => {
    const archive = archiveRef.current
    const shell = archive?.parentElement
    const caption = shell?.querySelector<HTMLElement>('.carousel-caption')
    if (!archive || !shell || !caption) return

    let frame = 0
    const textRect = (element: Element) => {
      const range = document.createRange()
      range.selectNodeContents(element)
      return range.getBoundingClientRect()
    }
    const align = () => {
      const previous = Number.parseFloat(shell.style.getPropertyValue('--caption-lift')) || 0
      if (!window.matchMedia('(min-width: 801px)').matches || archive.scrollHeight <= archive.clientHeight) {
        shell.style.setProperty('--caption-lift', '0px')
        return
      }
      const bounds = archive.getBoundingClientRect()
      const bottom = textRect(caption).bottom + previous
      let lastBottom = 0
      archive.querySelectorAll('.work-row .title > span, .contact a').forEach((element) => {
        const rect = textRect(element)
        if (rect.height && rect.top >= bounds.top - 0.5 && rect.bottom <= Math.min(bounds.bottom, bottom) + 0.5) {
          lastBottom = Math.max(lastBottom, rect.bottom)
        }
      })
      const lift = lastBottom ? Math.max(0, bottom - lastBottom) : 0
      if (Math.abs(lift - previous) > 0.5) shell.style.setProperty('--caption-lift', `${lift}px`)
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(align)
    }
    const observer = new ResizeObserver(schedule)
    observer.observe(archive)
    observer.observe(caption)
    archive.addEventListener('scroll', schedule, { passive: true })
    document.fonts.addEventListener('loadingdone', schedule)
    align()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      archive.removeEventListener('scroll', schedule)
      document.fonts.removeEventListener('loadingdone', schedule)
      shell.style.removeProperty('--caption-lift')
    }
  }, [archiveRef, filter, previewing])
}

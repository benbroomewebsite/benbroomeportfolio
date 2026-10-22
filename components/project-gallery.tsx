import Image from 'next/image'
import { type CSSProperties, Fragment, type ReactNode } from 'react'
import { mediaHref } from '@/lib/media'
import { galleryRows, isNarrowRow, isPortrait, ratioOf, rowMaxWidth, rowSide } from '@/lib/gallery-layout'
import { isPdfPage } from '@/lib/project-view'
import type { Work, WorkImage, WorkVideo } from '@/lib/works'

type GalleryProps = {
  work: Work
  /** The images in the order to show them (shuffled or as saved). */
  images: WorkImage[]
  /** Show each image's editor position and file name (?edit on the address). */
  labelled: boolean
  /** Shown after the opening row, such as the exhibition text. */
  afterOpening?: ReactNode
}

// Photos in rows, grouped under their section headings, with the videos.
export function ProjectGallery({ work, images, labelled, afterOpening }: GalleryProps) {
  // Sections follow the saved order of their first image, whatever the shuffle.
  const groups = [...new Set([
    ...work.images.filter((image) => !isPdfPage(image)).map((image) => image.group ?? ''),
    ...work.videos.filter((video) => video.group).map((video) => video.group!),
  ])]
  // The first video without a section of its own sits under the opening image; the rest follow the gallery.
  const looseVideos = work.videos.filter((video) => !video.group)
  const leadVideo = images.some((image) => !image.group) ? looseVideos[0] : undefined
  // The lead video shares its row with the first portrait after the opening image, so it sits smaller beside a photo.
  const videoPartner = leadVideo
    ? images.filter((image) => !image.group).slice(1).find((image) => isPortrait(image) && (!image.layout || image.layout === 'auto'))
    : undefined

  const item = (image: WorkImage) => {
    const picture = <Image src={mediaHref(image.src)} alt={image.alt} width={image.width ?? 1600} height={image.height ?? 1200} sizes="(max-width: 800px) 100vw, 66vw" />
    const style = { '--ratio': ratioOf(image) } as CSSProperties
    // Images stay on the page; only the "Read on …" link leaves the site.
    return <div key={image.src} className="gallery-item" style={style}>
      {picture}
      {labelled && <span className="gallery-label">{work.images.indexOf(image) + 1} · {image.src.split('/').pop()}<br /><small>{image.src}</small></span>}
    </div>
  }

  return <>
    {groups.length > 0 && <div className="project-gallery">
      {groups.map((group) => <section className="gallery-group" key={group}>
        {group && <h2>{group}</h2>}
        {galleryRows(images.filter((image) => (image.group ?? '') === group && image !== videoPartner)).map((row, rowIndex) => {
          const side = rowSide(row, rowIndex)
          const opening = !group && rowIndex === 0
          return <Fragment key={row[0].src}>
            <div className={`gallery-row${isNarrowRow(row) ? ' gallery-row-narrow' : ''}${side ? ` gallery-row-${side}` : ''}`} style={{ maxWidth: rowMaxWidth(row) }}>
              {row.map(item)}
            </div>
            {opening && leadVideo && (videoPartner
              ? <div className="gallery-row">{item(videoPartner)}<Video video={leadVideo} beside /></div>
              : <Video video={leadVideo} />)}
            {opening && afterOpening}
          </Fragment>
        })}
        {work.videos.filter((video) => video.group === group).map((video) => <Video key={video.src} video={video} />)}
      </section>)}
    </div>}
    {looseVideos.filter((video) => video !== leadVideo).map((video) => <Video key={video.src} video={video} />)}
  </>
}

// Beside a photo the video takes a share of the row by its shape (the films are 16:9) and drops its caption.
function Video({ video, beside = false }: { video: WorkVideo; beside?: boolean }) {
  return <figure className={`project-video${beside ? ' gallery-item' : ''}`} style={beside ? { '--ratio': 16 / 9 } as CSSProperties : undefined}>
    <video controls playsInline preload="metadata" aria-label={video.label}>
      <source src={mediaHref(video.src)} type="video/mp4" />
      <a href={mediaHref(video.src)}>Download video</a>
    </video>
    {!beside && <figcaption>{video.label}</figcaption>}
  </figure>
}

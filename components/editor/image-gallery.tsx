'use client'

import { type CSSProperties, useEffect, useRef, useState } from 'react'
import type { ImageGalleryProps } from '@/lib/editor-images'
import { mediaHref } from '@/lib/media'
import { galleryRows, isNarrowRow, ratioOf, rowMaxWidth, rowSide, type ImageLayout } from '@/lib/gallery-layout'
import styles from './image-gallery.module.css'

type ImageItem = ImageGalleryProps['elements'][number]

function Thumbnail({ item, number }: { item: ImageItem; number: number }) {
  const upload = item.fields.upload.value
  const [localUrl, setLocalUrl] = useState('')
  useEffect(() => {
    if (!upload) { setLocalUrl(''); return }
    const url = URL.createObjectURL(new Blob([new Uint8Array(upload.data)]))
    setLocalUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [upload])
  const src = upload ? localUrl : mediaHref(item.fields.src.value)
  return <div className={styles.thumbnail}>
    {src ? <img src={src} alt={item.fields.alt.value || `Image ${number}`} loading="lazy" draggable={false} onLoad={event => {
      const { naturalWidth: width, naturalHeight: height } = event.currentTarget
      if (upload && (item.fields.width.value !== width || item.fields.height.value !== height)) item.onChange({ width, height })
    }} /> : <span>Choose an image below</span>}
  </div>
}

export function ImageGalleryInput({ elements, onChange, forceValidation = false }: ImageGalleryProps) {
  const dragged = useRef<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [view, setView] = useState<'site' | 'phone' | 'grid'>('site')
  const move = (key: string, to: number) => {
    const from = elements.findIndex(item => item.key === key)
    if (from < 0 || to < 0 || to >= elements.length || from === to) return
    const next = elements.map(item => ({ key: item.key }))
    next.splice(to, 0, next.splice(from, 1)[0])
    onChange(next)
    setAnnouncement(`Image moved from position ${from + 1} to ${to + 1}. Save the project to keep this order.`)
  }

  const card = (item: ImageItem, index: number) => {
        const { layout: layoutField, ...editableFields } = item.fields
        const name = item.fields.originalName.value || item.fields.upload.value?.filename || item.fields.src.value.split('/').pop() || 'New image'
        return <article key={item.key} className={`${styles.card} ${over === item.key ? styles.over : ''}`}
          style={{ '--image-ratio': ratioOf({ width: item.fields.width.value, height: item.fields.height.value }), flex: `${ratioOf({ width: item.fields.width.value, height: item.fields.height.value })} 1 0%` } as CSSProperties}
          onDragOver={event => { if (dragged.current) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setOver(item.key) } }}
          onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(null) }}
          onDrop={event => { event.preventDefault(); if (dragged.current) move(dragged.current, index); dragged.current = null; setOver(null) }}>
          <div className={styles.dragArea} draggable tabIndex={0} role="button" aria-label={`Drag image ${index + 1}: ${name}. Use Alt and arrow keys to move.`}
            onKeyDown={event => { if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'ArrowRight' || event.key === 'ArrowDown')) { event.preventDefault(); move(item.key, index + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1)) } }}
            onDragStart={event => { dragged.current = item.key; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.key) }}
            onDragEnd={() => { dragged.current = null; setOver(null) }}>
            <Thumbnail item={item} number={index + 1} />
            <span className={styles.position}>{index + 1} <span aria-hidden="true">⠿</span></span>
          </div>
          <div className={styles.caption}><p title={name}>{name}</p>{item.fields.group.value && <span className={styles.section}>{item.fields.group.value}</span>}</div>
          <div className={styles.actions}>
            <button type="button" disabled={index === 0} aria-label={`Move image ${index + 1} earlier`} onClick={() => move(item.key, index - 1)}>←</button>
            <button type="button" disabled={index === elements.length - 1} aria-label={`Move image ${index + 1} later`} onClick={() => move(item.key, index + 1)}>→</button>
            <button type="button" className={styles.remove} aria-label={`Remove image ${index + 1}`} onClick={() => { if (window.confirm(`Remove ${name} from this project? The stored file will be kept.`)) onChange(elements.filter(other => other.key !== item.key).map(other => ({ key: other.key }))) }}>Remove</button>
          </div>
          <label className={styles.layoutControl}>Photo layout
            <select aria-label={`Image ${index + 1} layout`} value={layoutField.value} onChange={event => layoutField.onChange(event.target.value as ImageLayout)}>
              <option value="auto">Automatic</option><option value="full">Full width</option><option value="pair">Pair with next</option><option value="left">Small, left</option><option value="right">Small, right</option>
            </select>
          </label>
          <details className={styles.details} open={!item.fields.src.value && !item.fields.upload.value || undefined}>
            <summary>Edit image</summary>
            <div className={styles.fields}>{Object.entries(editableFields).map(([key, field]) => {
              const Input = field.schema.Input
              return <Input key={key} value={field.value as never} onChange={field.onChange as never} autoFocus={false} forceValidation={forceValidation} />
            })}</div>
          </details>
        </article>
  }
  const images = elements.map((item, index) => ({ item, index, width: item.fields.width.value, height: item.fields.height.value, layout: item.fields.layout.value, group: item.fields.group.value }))
  const groups = [...new Set(images.map(image => image.group))]

  return <section className={styles.gallery} aria-label="Image organiser">
    <div className={styles.heading}><h3>Images <span>({elements.length})</span></h3>
      <button type="button" onClick={() => onChange([...elements.map(item => ({ key: item.key })), { key: undefined }])}>+ Add image</button>
    </div>
    <p className={styles.help}>Drag photos into place, then choose their size or pair them with the next photo. The desktop view uses the site’s photo proportions and row rules. Videos and documents are not shown here. Open “Edit image” for captions, uploads and section headings.</p>
    <p className={styles.help}>Choose “Saved order” above to publish this arrangement. “Random each visit” shuffles it for visitors. Images sharing a section stay together; sections follow their first image. Save the project when finished.</p>
    <div className={styles.views} role="group" aria-label="Gallery preview">
      {(['site', 'phone', 'grid'] as const).map(mode => <button key={mode} type="button" aria-pressed={view === mode} onClick={() => setView(mode)}>{mode === 'site' ? 'Desktop layout' : mode === 'phone' ? 'Phone layout' : 'Thumbnail grid'}</button>)}
    </div>
    {view === 'grid' ? <div className={styles.grid}>{elements.map(card)}</div> : <div className={`${styles.site} ${view === 'phone' ? styles.phone : ''}`}>
      {groups.map(group => <div key={group} className={styles.group}>
        {group && <h4>{group}</h4>}
        {galleryRows(images.filter(image => image.group === group)).map((row, rowIndex) => <div key={row[0].item.key}
          className={`${styles.siteRow} ${isNarrowRow(row) ? styles.narrow : ''} ${rowSide(row, rowIndex) === 'right' ? styles.right : ''}`}
          style={{ maxWidth: rowMaxWidth(row) }}>
          {row.map(image => card(image.item, image.index))}
        </div>)}
      </div>)}
    </div>}
    {!elements.length && <p className={styles.empty}>No images yet. Add an image to start the gallery.</p>}
    <p className={styles.status} role="status" aria-live="polite">{announcement}</p>
  </section>
}

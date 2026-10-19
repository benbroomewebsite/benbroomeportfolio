export type ImageLayout = 'auto' | 'full' | 'pair' | 'left' | 'right'
export type GalleryImage = { width?: number | null; height?: number | null; layout?: ImageLayout }

export const GALLERY_GAP = 18
export const ratioOf = (image: GalleryImage) => image.width && image.height ? image.width / image.height : 4 / 3
export const isPortrait = (image: GalleryImage) => ratioOf(image) < 0.95
export const isNarrowRow = (row: readonly GalleryImage[]) => row.length === 1 &&
  (row[0].layout === 'left' || row[0].layout === 'right' || ((!row[0].layout || row[0].layout === 'auto') && isPortrait(row[0])))

// Shared by the public gallery and the visual editor, including explicit sizes.
export function galleryRows<T extends GalleryImage>(images: readonly T[]): T[][] {
  const rows: T[][] = []
  let pairLandscapes = false
  for (let index = 0; index < images.length;) {
    const image = images[index]
    const next = images[index + 1]
    const layout = image.layout || 'auto'
    const nextCanPair = next && (!next.layout || next.layout === 'auto')
    const pair: boolean = Boolean(nextCanPair && (layout === 'pair' || (layout === 'auto' && (isPortrait(image) || (pairLandscapes && !isPortrait(next))))))
    rows.push(pair ? [image, next] : [image])
    if (!isPortrait(image)) pairLandscapes = !pair
    index += pair ? 2 : 1
  }
  return rows
}

// Avoid enlarging archive photographs beyond their own pixels.
export function rowMaxWidth(row: readonly GalleryImage[]): number | undefined {
  if (row.some(image => !image.width || !image.height)) return undefined
  if (isNarrowRow(row)) return row[0].width! * 2 + GALLERY_GAP
  const height = Math.min(...row.map(image => image.height!))
  return Math.round(row.reduce((total, image) => total + ratioOf(image) * height, 0) + GALLERY_GAP * (row.length - 1))
}

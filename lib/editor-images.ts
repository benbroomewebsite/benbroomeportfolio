import { createElement } from 'react'
import { fields, type PreviewProps } from '@keystatic/core'
import { ImageGalleryInput } from '@/components/editor/image-gallery'

const image = fields.object({
  upload: fields.image({ label: 'Upload an image', description: 'JPEG, PNG or WebP, ideally no wider than 2400 pixels.', directory: 'public/uploads/works', publicPath: '/uploads/works/' }),
  src: fields.text({ label: 'Existing image path', description: 'For images already stored on the site. Keep this when replacing only the caption.' }),
  alt: fields.text({ label: 'Image description' }),
  group: fields.text({ label: 'Section heading', description: 'Images with the same heading appear together on the project page.' }),
  width: fields.integer({ label: 'Width', description: 'Automatic for new uploads.' }),
  height: fields.integer({ label: 'Height' }),
  originalName: fields.text({ label: 'Original file name' }),
})

const gallery = fields.array(image, { label: 'Images' })
export type ImageGalleryProps = PreviewProps<typeof gallery> & { forceValidation?: boolean }

// Keep Keystatic's native array/asset serialization and GitHub save flow.
export const editorImages = {
  ...gallery,
  Input(props: unknown) {
    return createElement(ImageGalleryInput, props as ImageGalleryProps)
  },
}

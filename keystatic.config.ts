import { collection, config, fields } from '@keystatic/core'

// Locally the editor writes straight to content/works. With
// NEXT_PUBLIC_KEYSTATIC_STORAGE=github it signs editors in with GitHub and
// commits their changes to the repository, which redeploys the site.
const github = process.env.NEXT_PUBLIC_KEYSTATIC_STORAGE === 'github'
export const editorEnabled = github || process.env.NODE_ENV === 'development'

const link = (label: string) => fields.array(
  fields.object({
    label: fields.text({ label: 'Label' }),
    href: fields.text({ label: 'Address', description: 'A web address, or a registered /files/… path for a PDF.' }),
  }),
  { label, itemLabel: (props) => props.fields.label.value || props.fields.href.value },
)

export default config({
  storage: github ? { kind: 'github', repo: 'notadev111/benbroomeportfolio' } : { kind: 'local' },
  ui: { brand: { name: 'Ben Broome' } },
  collections: {
    works: collection({
      label: 'Projects',
      slugField: 'title',
      path: 'content/works/*',
      format: { data: 'json' },
      columns: ['category', 'date', 'publication'],
      schema: {
        title: fields.slug({
          name: { label: 'Title', validation: { isRequired: true } },
          slug: { label: 'Page address', description: 'The last part of the project URL. Changing it changes the link.' },
        }),
        category: fields.select({
          label: 'Filter',
          description: 'Which filter the project appears under.',
          options: ['Exhibition', 'Selected Writing', 'Performance', 'Talk', 'Artist Grant', 'Press'].map((value) => ({ label: value, value })),
          defaultValue: 'Exhibition',
        }),
        type: fields.text({ label: 'Medium', description: 'Shown next to the title, e.g. Exhibition, Writing, Performance.' }),
        publication: fields.text({ label: 'Venue or publication' }),
        date: fields.text({
          label: 'Date',
          description: 'As precise as you know it: 2025, 2025-10 or 2025-10-04.',
          validation: { pattern: { regex: /^(\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?)?$/, message: 'Use 2025, 2025-10 or 2025-10-04.' } },
        }),
        description: fields.text({ label: 'Text', description: 'Leave a blank line between paragraphs.', multiline: true }),
        externalHref: fields.text({ label: 'External link', description: 'For writing and press: where the piece can be read.' }),
        links: link('Links'),
        files: link('Documents'),
        featuredImage: fields.text({ label: 'Preview image', description: 'The image path shown when hovering the project in the index.' }),
        images: fields.array(
          fields.object({
            src: fields.text({ label: 'Image path' }),
            alt: fields.text({ label: 'Description' }),
            group: fields.text({ label: 'Section heading' }),
            width: fields.integer({ label: 'Width' }),
            height: fields.integer({ label: 'Height' }),
            originalName: fields.text({ label: 'Original file name' }),
          }),
          { label: 'Images', description: 'Drag to reorder. New images still need uploading separately.', itemLabel: (props) => props.fields.src.value },
        ),
        videos: fields.array(
          fields.object({
            src: fields.text({ label: 'Video path' }),
            label: fields.text({ label: 'Caption' }),
            group: fields.text({ label: 'Section heading' }),
          }),
          { label: 'Videos', itemLabel: (props) => props.fields.label.value || props.fields.src.value },
        ),
        legacySlug: fields.text({ label: 'Old page address', description: 'Redirects here from a previous URL. Usually left alone.' }),
        order: fields.integer({ label: 'Order', description: 'Breaks ties between projects with the same date. Lower comes first.' }),
      },
    }),
  },
})

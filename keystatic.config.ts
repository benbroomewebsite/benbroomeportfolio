import { collection, config, fields, singleton } from '@keystatic/core'
import { editorImages } from './lib/editor-images'

// Locally the editor writes straight to content/works. With
// NEXT_PUBLIC_KEYSTATIC_STORAGE=github it signs editors in with GitHub and
// commits their changes to the repository, which redeploys the site.
const github = process.env.NEXT_PUBLIC_KEYSTATIC_STORAGE === 'github'
export const editorEnabled = github || process.env.NODE_ENV === 'development'

// Uploads are saved into the repository under public/uploads and served by the
// site itself; the older archive stays in the media bucket and is named by path.
const uploads = { directory: 'public/uploads/works', publicPath: '/uploads/works/' }

const webAddress = { regex: /^https?:\/\/\S+$/, message: 'A full address, starting https://' }
const optionalWebAddress = { regex: /^(https?:\/\/\S+)?$/, message: webAddress.message }

// Only the main branch is published. Should a save land on a new branch made in
// the editor, it is named editor/… and .github/workflows/publish-editor-branches.yml
// merges it into main. The workflow also supports the older Alice branch and
// synchronises editor branches after publication to avoid stale snapshots.
export default config({
  storage: github ? { kind: 'github', repo: 'benbroomewebsite/benbroomeportfolio', branchPrefix: 'editor/' } : { kind: 'local' },
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
        indexTitle: fields.text({ label: 'Name in the index', description: 'A short name for the list, usually the artist. Leave empty to use the title.' }),
        category: fields.select({
          label: 'Filter',
          description: 'Which filter the project appears under.',
          options: ['Exhibition', 'Selected Writing', 'Performance', 'Talk', 'Artist Grant', 'Press'].map((value) => ({ label: value, value })),
          defaultValue: 'Exhibition',
        }),
        alsoInWriting: fields.checkbox({
          label: 'Also list under Selected Writing',
          description: 'For an exhibition whose text you wrote. It appears once under All and also under Selected Writing.',
        }),
        hiddenFromAll: fields.checkbox({
          label: 'Leave out of the All list',
          description: 'Listed only under its own filter, e.g. an interview already linked from its exhibition.',
        }),
        type: fields.text({ label: 'Medium', description: 'Shown next to the title, e.g. Exhibition, Writing, Performance.' }),
        publication: fields.text({ label: 'Venue or publication' }),
        date: fields.text({
          label: 'Date',
          description: 'As precise as you know it: 2025, 2025-10 or 2025-10-04.',
          validation: { isRequired: true, pattern: { regex: /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/, message: 'Use 2025, 2025-10 or 2025-10-04.' } },
        }),
        description: fields.text({ label: 'Text', description: 'Leave a blank line between paragraphs.', multiline: true }),
        externalHref: fields.text({ label: 'External link', description: 'For writing and press: where the piece can be read.', validation: { pattern: optionalWebAddress } }),
        links: fields.array(
          fields.object({
            label: fields.text({ label: 'Label', validation: { isRequired: true } }),
            href: fields.text({ label: 'Web address', validation: { isRequired: true, pattern: webAddress } }),
          }),
          { label: 'Links', itemLabel: (props) => props.fields.label.value || props.fields.href.value },
        ),
        files: fields.array(
          fields.object({
            label: fields.text({ label: 'Label' }),
            upload: fields.file({ label: 'Upload a PDF', description: 'For a new document. Leave empty for one that is already on the site.', ...uploads }),
            href: fields.text({ label: 'Existing document path', description: 'Set for documents already on the site. Leave alone.' }),
            display: fields.select({
              label: 'Show as',
              description: 'Read on the page shows the PDF beside or beneath the images. Link on the left lists it under the other links, e.g. a press release.',
              options: [{ label: 'Read on the page', value: 'inline' }, { label: 'Link on the left', value: 'link' }],
              defaultValue: 'inline',
            }),
          }),
          { label: 'Documents', itemLabel: (props) => props.fields.label.value || props.fields.href.value || props.fields.upload.value?.filename || 'New document' },
        ),
        featuredImage: fields.text({ label: 'Preview image', description: 'Fallback when the project has no gallery images. Gallery previews are chosen randomly on each visit.' }),
        imageOrder: fields.select({
          label: 'Gallery order',
          description: 'Choose whether visitors see your saved arrangement or a fresh shuffle.',
          options: [{ label: 'Random each visit', value: 'random' }, { label: 'Saved order', value: 'manual' }],
          defaultValue: 'random',
        }),
        images: editorImages,
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
  singletons: {
    site: singleton({
      label: 'Bio and contact',
      path: 'content/site',
      format: { data: 'json' },
      schema: {
        bio: fields.text({ label: 'Bio', description: 'Shown on the Bio page. Leave a blank line between paragraphs.', multiline: true }),
        portrait: fields.image({ label: 'Portrait', description: 'Optional photo of Ben for the Bio page.', directory: 'public/uploads/bio', publicPath: '/uploads/bio/' }),
        portraitAlt: fields.text({ label: 'Portrait description', defaultValue: 'Ben Broome' }),
        portraitCredit: fields.text({ label: 'Photo credit' }),
        email: fields.text({ label: 'Email address' }),
        instagram: fields.text({ label: 'Instagram address', description: 'The full address, starting https://' }),
      },
    }),
  },
})

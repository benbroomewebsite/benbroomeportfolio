# benbroomeportfolio

Ben Broome's portfolio: an index of exhibitions, writing, performances, talks and
artist grants, with a page for each project. Next.js on Vercel, content edited
by Ben in Keystatic at `/keystatic`, media in the `benbroome-portfolio-media` R2
bucket.

Live site: https://benbroomeportfolio-two.vercel.app (Vercel deploys every push
to `main`; other branches get preview deployments).

## How a change reaches the site

1. Ben edits a project at `/keystatic` and presses **Save**. Each save is a commit
   to `main` on GitHub.
2. Vercel builds. `scripts/build-works.mjs` collects `content/works/*.json` into
   `lib/generated/works.json`, then `scripts/check-portfolio.cjs` and
   `scripts/check-gallery-layout.cjs` run.
3. The site updates a minute or two later.

Two safeguards keep a save from going missing:

- **Editor branches are published.** Keystatic can save to a new branch from its
  branch menu. Such branches are named `editor/…` (`branchPrefix` in
  `keystatic.config.ts`), and `.github/workflows/publish-editor-branches.yml`
  merges them into `main`.
- **Content cannot break the build.** A failed build leaves the site on its old
  version without telling Ben. The editor requires a date and full link
  addresses, and `build-works.mjs` leaves out anything still broken (a mistyped
  image path, an incomplete link) with a warning in the Vercel build log. The
  checks that follow test the code, so a failure there is a bug to fix here.

## Code layout

| Path | What it holds |
| --- | --- |
| `app/(site)/` | Pages: the index (`page.tsx`), `bio/`, `work/[slug]/` |
| `app/api/document/` | Streams registered PDFs from R2, with byte ranges |
| `app/keystatic/`, `app/api/keystatic/` | The editor |
| `components/portfolio.tsx` | The index, filters, hover preview and slideshow |
| `components/project.tsx` | A project page, composed from `project-text.tsx` (text, grant headings, links) and `project-gallery.tsx` (photo rows, videos) |
| `components/pdf-reader.tsx` | The in-page PDF reader |
| `components/editor/` | The visual image organiser in the editor |
| `lib/works.ts` | Project types, normalisation of editor content, ordering |
| `lib/project-view.ts` | What a project page shows: documents, links, embeds |
| `lib/gallery-layout.ts` | Photo row rules, shared by the site and the editor |
| `lib/carousel.ts`, `lib/bio.ts` | Home slideshow; bio and contact |
| `lib/media.ts`, `lib/media-map.json` | Site paths to R2 objects |
| `content/works/`, `content/site.json` | The content, one file per project |
| `scripts/` | Build, checks and media tools in use |
| `scripts/archive/` | The one-off Squarespace migration, kept for reference |

## Editing projects

Each project is one file in `content/works/`. The date field takes `2025`,
`2025-10` or `2025-10-04`, whichever is known; year-only projects follow the
dated ones in their year.

- **Filter** sets where a project is listed. **Also list under Selected Writing**
  adds an exhibition to that filter too (as "Exhibition text"), without repeating
  it under All. **Leave out of the All list** keeps a piece under its own filter
  only, e.g. an interview already linked from its exhibition.
- **Exhibition documents and press** appear as links on the left; the gallery stays for photos and videos. This applies even to older documents saved as inline.
- **Documents** are PDFs. **Show as** chooses **Read on the page** (beside or
  beneath the images, and also linked on the left) or **Link on the left** only,
  for example a press release.
- Writing whose only form is a scan of the page (Rag-trade Medicis) opens in a
  full-size reader over the blurred page, from its image or **Read**.
- **External link** is where writing published elsewhere can be read. The project
  still gets its own page, with its image and a "Read on …" link. Frieze, Ocula
  and most publications refuse to be shown inside another site, so only those
  listed in `lib/project-view.ts` are embedded.
- **Images** opens in **Desktop layout**, showing rows by the site's own rules;
  **Phone layout** and **Thumbnail grid** are alternatives. Each photo can be
  Automatic, Full width, Pair with next, Small left or Small right. Drag a photo
  into place or use its arrows; **Edit image** replaces it or changes its
  description and section heading.
- **Gallery order** is **Random each visit** (the default) or **Saved order**.
  Images with the same section heading stay together, in sections ordered by
  their first image. Add `?edit` to a project address to see the saved order with
  numbered labels.
- Artist grant texts written with lines such as `The Judging Panel:` and
  `WINNERS:` show those as headings, with each winner's name line in bold.

Locally, run `pnpm dev` and open http://localhost:3000/keystatic; saving rewrites
the project's file. Restart `pnpm dev` to see the edit on the site.

Writing that is only a link gets a lead image and opening lines from the
article's share tags: `python scripts/fetch_article_previews.py` saves them to
`public/previews/`.

## Media

Original project folders are kept in `source-media/` (not in Git).
`lib/media-map.json` maps site paths to the R2 bucket; editor uploads are stored
in `public/uploads/` and served by the site. Gallery rows use each image's
dimensions, recorded in the project files (rebuilt by `scripts/record_image_sizes.py`;
editor uploads are measured by `build-works.mjs`).

To rebuild the new project media (Pillow, PyMuPDF, requests and ffmpeg required):

```powershell
python scripts/import_new_media.py
python scripts/prepare_reading_pdf.py
node node_modules/wrangler/bin/wrangler.js whoami
python scripts/sync_r2_media.py
python scripts/sync_r2_media.py --verify-only
```

The importer leaves source files intact, produces 2400px WebP images and
H.264/AAC MP4 videos, and keeps the original photos, videos and PDFs in R2.
`lib/new-media-manifest.json` records each source file, object key, size and
SHA-256 hash. The sync is resumable, repairs missing or mismatched objects and
deletes nothing from R2.

PDF.js assets are prepared on install and before development and builds. The
oversized Arcane scan has a smaller reading copy recorded in
`lib/pdf-reading-map.json`; its Download control still returns the original.

## Development

```powershell
pnpm install
pnpm dev     # http://localhost:3000
pnpm check   # collect content, then run the data and layout checks
pnpm build
```

Dates and their sources: `scripts/archive/import-data/date-research.json`, with
open questions in `docs/date-audit.md`. Editor setup: `docs/editor-setup.md`.
Open questions for Ben: `docs/questions-for-ben.md`.

`scripts/archive/export-content.cjs` created `content/works/` from the Squarespace
import once; running it again would overwrite later edits. If rebuilding the
legacy archive, run `scripts/archive/assemble_portfolio.py` and
`scripts/archive/build_r2_staging.py` before `scripts/import_new_media.py`.

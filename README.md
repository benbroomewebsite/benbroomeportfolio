# benbroomeportfolio

## Editing projects

Each project is one file in `content/works/`, edited through a form at
`/keystatic` (titles, medium, venue, dates, text, links, image order). The date
field takes `2025`, `2025-10` or `2025-10-04`, whichever is known. Run `pnpm dev`
and open http://localhost:3000/keystatic to edit locally; saving rewrites the
project's file. `scripts/build-works.mjs` collects the files into
`lib/generated/works.json` before `dev`, `build` and `check`, so restart `pnpm dev`
to see a local edit on the site.

Link-only writing entries get a lead image and opening lines from the article's
own share tags: `python scripts/fetch_article_previews.py` saves the images to
`public/previews/` and fills in entries that have no PDF or image yet.

On the deployed site the editor is switched off until GitHub sign-in is set up.
See `docs/editor-setup.md`. Once it is on, each save is a commit to this
repository, and Vercel redeploys.

The files under `scripts/import-data/` and `scripts/legacy-works.ts` are the
original Squarespace import and its date research, kept for reference.
`scripts/export-content.cjs` created `content/works/` from them once; running it
again would overwrite later edits.

## Portfolio media

Original project folders are retained in `source-media/` and excluded from Git.
`content/works/` contains the project entries; `lib/media-map.json` maps their
media to the existing `benbroome-portfolio-media` R2 bucket. Rooms of Neighbours
is one exhibition with gallery sections for each artist. Talks have their own
filter. Projects are newest first within each year using supplied and researched
dates. Year-only records follow the precisely dated records in that year.

The desktop index previews a random project image on hover or keyboard focus. Clicking opens
a dedicated project page: title, full text, links and the Images/Read switch sit
in a narrow left column, and the gallery, videos or PDF fill the rest. Gallery
images shuffle on each visit within their saved artist sections. The home slideshow
also shuffles. Add `?edit` to a project URL to see its saved order and numbered
image labels. Gallery rows pair portraits and alternate landscapes between full width and pairs, using
the dimensions in `lib/image-sizes.json` (rebuilt by `scripts/record_image_sizes.py`).
On phones the index stacks each entry (title, venue or publication, date, type)
and projects open directly with a Back to index link at the top and bottom; the
index filter and scroll position are restored when returning.

`scripts/import-data/date-research.json` records the sources for researched dates. `docs/date-audit.md` lists the unresolved dates
and conflicting metadata. `lib/project-resources.json` restores the legacy
projects' own press releases and links, excluding neighbouring listing content.

Run `pnpm check` to validate chronology, date provenance, project URLs and all
registered media references before deployment.

To rebuild the new project media (Pillow, PyMuPDF, requests and ffmpeg required):

```powershell
python scripts/import_new_media.py
python scripts/prepare_reading_pdf.py
node node_modules/wrangler/bin/wrangler.js whoami
python scripts/sync_r2_media.py
```

The importer leaves source files intact, produces 2400px WebP images and
H.264/AAC MP4 videos, and retains original photos, videos and PDFs in R2.
`lib/new-media-manifest.json` records every original source file, object key,
size and SHA-256 hash. `r2-staging/verification-report.json` records public
object verification by hash, byte length and Content-Type. The sync is resumable,
repairs missing or mismatched objects, and does not delete anything from R2.

PDFs open inside the right-hand document reader, with automatically sized pages,
scrolling, selectable text and downloads. Exhibition entries keep their
image galleries and offer a document switch for press releases. PDF.js assets
are prepared automatically on install, before development and before builds;
`/api/document` streams registered R2 PDFs with byte-range support.
The oversized Arcane scan has a smaller reading copy recorded in
`lib/pdf-reading-map.json`; its Download control still returns the original PDF.

```powershell
python scripts/sync_r2_media.py --verify-only
```

If rebuilding the legacy Squarespace archive, run `assemble_portfolio.py` and
`build_r2_staging.py` **before** `import_new_media.py`; the legacy assembly replaces
the project data. The uploader excludes manifests and verification files.

## Prototype deployment

The prototype is hosted at https://ben-broome-prototype.vercel.app on the Vercel project `ben-broome-prototype`. Vercel deploys updates pushed to `main` automatically. Feature branches get preview deployments. The existing benbroome.co.uk domain is not connected to this prototype.

## Local development

```powershell
pnpm install
pnpm dev
```

Open http://localhost:3000. `pnpm check` validates the data; `pnpm build` makes
the production build.

The original Squarespace scrapers are kept in `scripts/squarespace_full_migration.py`
and `scripts/download_ben_squarespace_images.py`. Open questions for Ben are
logged in `docs/questions-for-ben.md`.

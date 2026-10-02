# benbroomeportfolio

## Portfolio media

Original project folders are retained in `source-media/` and excluded from Git.
`lib/works.json` contains the project entries; `lib/media-map.json` maps their
media to the existing `benbroome-portfolio-media` R2 bucket. Rooms of Neighbours
is one exhibition with gallery sections for each artist. Talks have their own
filter. New entries use the supplied month/date, newest first within each year;
the existing archive keeps its curated sequence where precise dates are unknown.

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

This is a [Next.js](https://nextjs.org) project bootstrapped with [v0](https://v0.app).

## Built with v0

This repository is linked to a [v0](https://v0.app) project. You can continue developing by visiting the link below -- start new chats to make changes, and v0 will push commits directly to this repo. Every merge to `main` will automatically deploy.

[Continue working on v0 →](https://v0.app/chat/projects/prj_SfhdNREA74fxjIDH7O5CVCkoYdVR)

## Getting Started

## Prototype deployment

The prototype is hosted at https://ben-broome-prototype.vercel.app on the Vercel project `ben-broome-prototype`. Vercel deploys updates pushed to `main` automatically. Feature branches get preview deployments. The existing benbroome.co.uk domain is not connected to this prototype.

## Local development

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [v0 Documentation](https://v0.app/docs) - learn about v0 and how to use it.

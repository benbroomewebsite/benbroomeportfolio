# R2 media migration

## Ben's destination (25 October 2026)

Transfer completed and verified: **1,366 objects / 3,825,618,106 bytes**.
All destination keys, sizes, MD5 ETags and HTTP/custom metadata match the source;
there are no failures, mismatches or extra objects. Local source bytes were
checked against the original SHA-256 manifest before uploading.

- Account: `856d30a7c55ce0475ebcac06e973dc57`.
- Bucket: `benbroome-portfolio-media` (Western Europe, Standard).
- Custom media origin: `https://media.benbroome.co.uk` (ownership and TLS active).
- Copy tool: `python scripts/migrate_r2_account.py`, using Ben's Wrangler login.
  It verifies every local SHA-256 before writing, preserves Content-Type and
  Cache-Control, and compares the final destination keys, sizes, MD5 ETags and
  metadata. It does not delete remote objects. Rerunning skips matching objects.
- Destination verification report: `docs/r2-mirror/ben-migration-verification.json`.
  Only a report with no failures, mismatches or extra keys proves completion.
- The original source inventory and SHA-256 report remain unchanged.

After verification, set Vercel's `NEXT_PUBLIC_MEDIA_BASE_URL` to
`https://media.benbroome.co.uk` and redeploy (public environment values are
embedded at build time). Change `NEXT_PUBLIC_SITE_URL` only when the website's
custom domain is connected. The running website has not been switched by the
bucket-copy tool. Keep the old bucket until the deployed website is checked.

Verified on 23 October 2026: `r2-bucket/` contains exactly the live
`benbroome-portfolio-media` bucket's **1,366 objects / 3,825,618,106 bytes**.
Every object path, size and content was checked, and the live inventory was
listed again to confirm it did not change during verification.

The mirror contains only bucket objects. Local-only reports are separate:

- `docs/r2-mirror/inventory.json`: all object keys, ETags, HTTP/custom metadata,
  storage classes and remote timestamps.
- `docs/r2-mirror/verification.json`: per-file SHA-256 hashes and verification time.
- `docs/r2-mirror/local-cleanup-plan.json`: audit of redundant local files.
- `docs/r2-mirror/cleanup-result.json`: deleted local folders and reclaimed space.

The downloader is `scripts/mirror_r2_bucket.py`. It uses the existing Wrangler
login or `CLOUDFLARE_API_TOKEN`, with optional `CLOUDFLARE_ACCOUNT_ID` and
`R2_BUCKET` overrides. It only reads R2. Refresh the Wrangler login with
`node node_modules/wrangler/bin/wrangler.js whoami`, then run:

```powershell
python scripts/mirror_r2_bucket.py
python scripts/mirror_r2_bucket.py --verify-only
```

The old staging folder, original source-folder duplicates, extracted Squarespace
media, and `public/work/` copies were removed after hash verification. Obsolete
staging thumbnails, generated alternatives, screenshots and browser logs were
also removed. Historical Squarespace text and manifests remain for provenance.
Seven equal-content objects exist under distinct keys in the live bucket; those
keys are intentionally preserved in the mirror. No remote objects were changed.

## Moving to Ben's account

1. Create the destination bucket in Ben's account and configure access locally.
2. Copy the contents of `r2-bucket/` to the bucket root, preserving key spelling,
   directory structure and object metadata from `inventory.json`. Do not upload
   the enclosing `r2-bucket` directory as a key prefix, or upload the reports.
3. Compare the complete destination key inventory, sizes and content with the
   recorded source inventory and SHA-256 manifest. Reapply HTTP/custom metadata
   where the transfer tool does not preserve it automatically.
4. Configure a media custom domain in Ben's Cloudflare account.
5. Update Vercel's `NEXT_PUBLIC_MEDIA_BASE_URL` and final `NEXT_PUBLIC_SITE_URL`,
   update the fallback URLs in `lib/media.ts`, `lib/site.ts` and tooling, and
   deploy. The media-map keys and individual project paths do not change.
6. Check photos, videos, PDF readers, downloads, previews, and editor uploads on
   desktop and mobile. Retain the original bucket until the destination is proven.

`public/uploads/`, `public/previews/`, fonts and application assets remain in the
repository and deploy through Vercel. They must not be removed as R2 duplicates.
Future uploads must target Ben's account explicitly; do not reuse the old account
ID, credentials or public bucket URL accidentally.

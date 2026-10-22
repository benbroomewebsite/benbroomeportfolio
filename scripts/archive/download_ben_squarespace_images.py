#!/usr/bin/env python3
"""
Download the highest-resolution/original Squarespace images used on benbroome.co.uk.

What it does:
- Crawls the public Ben Broome site.
- Follows internal pages only.
- Finds Squarespace CDN image URLs in img/src, data-src, srcset, links, and raw HTML.
- Removes Squarespace resize parameters such as ?format=1500w so the original asset URL is requested.
- Requests JPEG/PNG/GIF rather than WebP where possible, preserving the original uploaded filename.
- Deduplicates by canonical asset URL.
- Stores images in folders named after the page they came from.
- Writes manifest.csv and manifest.json.

Usage:
    python download_ben_squarespace_images.py

Optional:
    python download_ben_squarespace_images.py --out ben-images
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import html
import json
import re
import sys
import time
from collections import deque
from pathlib import Path
from urllib.parse import (
    parse_qsl,
    unquote,
    urlencode,
    urljoin,
    urlparse,
    urlunparse,
)

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

START_URL = "https://www.benbroome.co.uk/"
ALLOWED_HOSTS = {"www.benbroome.co.uk", "benbroome.co.uk"}
CDN_HOST_HINTS = (
    "images.squarespace-cdn.com",
    "static1.squarespace.com",
    "static.squarespace.com",
)

IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".gif", ".webp", ".tif", ".tiff")
SKIP_PAGE_EXTS = (
    ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".zip",
    ".doc", ".docx", ".mp4", ".mov", ".mp3", ".wav"
)

# Squarespace transformation params that should not be retained for original asset fetches.
DROP_QUERY_KEYS = {
    "format", "content-type", "width", "height", "quality",
    "crop", "fit", "auto", "dpr"
}

UA = "Mozilla/5.0 (compatible; BenBroomePortfolioMigration/1.0)"

# Explicitly avoid advertising WebP support; Squarespace's CDN may otherwise
# content-negotiate JPEG/PNG uploads into WebP.
HEADERS = {
    "User-Agent": UA,
    "Accept": "image/jpeg,image/png,image/gif,image/*;q=0.8,*/*;q=0.5",
}


def clean_page_url(url: str) -> str:
    p = urlparse(url)
    # Ignore fragments and most query params for crawling.
    return urlunparse((p.scheme or "https", p.netloc, p.path or "/", "", "", ""))


def canonical_asset_url(url: str) -> str:
    """Strip resize/transformation params while retaining any non-transform params."""
    url = html.unescape(url.strip().strip('"\''))
    p = urlparse(url)
    kept = [(k, v) for k, v in parse_qsl(p.query, keep_blank_values=True)
            if k.lower() not in DROP_QUERY_KEYS]
    return urlunparse((p.scheme, p.netloc, p.path, p.params, urlencode(kept), ""))


def is_internal_page(url: str) -> bool:
    p = urlparse(url)
    if p.scheme not in ("http", "https"):
        return False
    if p.netloc.lower() not in ALLOWED_HOSTS:
        return False
    path = p.path.lower()
    return not path.endswith(SKIP_PAGE_EXTS)


def looks_like_image_url(url: str) -> bool:
    p = urlparse(url)
    host = p.netloc.lower()
    path = unquote(p.path).lower()
    if any(h in host for h in CDN_HOST_HINTS):
        return any(ext in path for ext in IMAGE_EXTS) or "/content/" in path
    return any(path.endswith(ext) for ext in IMAGE_EXTS)


def extract_urls_from_srcset(value: str) -> list[str]:
    out = []
    for item in value.split(","):
        item = item.strip()
        if not item:
            continue
        out.append(item.split()[0])
    return out


def extract_assets_and_links(page_url: str, text: str):
    soup = BeautifulSoup(text, "html.parser")
    assets: set[str] = set()
    links: set[str] = set()

    # Standard image attributes used by Squarespace.
    image_attrs = (
        "src", "data-src", "data-image", "data-url",
        "data-image-url", "data-load", "poster"
    )
    for tag in soup.find_all(True):
        for attr in image_attrs:
            value = tag.get(attr)
            if value:
                u = urljoin(page_url, value)
                if looks_like_image_url(u):
                    assets.add(canonical_asset_url(u))

        for attr in ("srcset", "data-srcset"):
            value = tag.get(attr)
            if value:
                for candidate in extract_urls_from_srcset(value):
                    u = urljoin(page_url, candidate)
                    if looks_like_image_url(u):
                        assets.add(canonical_asset_url(u))

    # Links may point directly to a "View fullsize" original image.
    for a in soup.find_all("a", href=True):
        u = urljoin(page_url, a["href"])
        if looks_like_image_url(u):
            assets.add(canonical_asset_url(u))
        elif is_internal_page(u):
            links.add(clean_page_url(u))

    # Squarespace sometimes embeds CDN URLs in JSON/script/style content instead
    # of visible attributes. Catch those too.
    raw_patterns = [
        r'https?:\\?/\\?/(?:images\.squarespace-cdn\.com|static1?\.squarespace\.com)[^"\'<>\s)]+',
    ]
    for pat in raw_patterns:
        for match in re.findall(pat, text, flags=re.I):
            u = match.replace("\\/", "/")
            u = html.unescape(u)
            # Trim common JSON/CSS punctuation.
            u = u.rstrip("\\,;")
            if looks_like_image_url(u):
                assets.add(canonical_asset_url(u))

    return sorted(assets), sorted(links)


def page_folder(page_url: str) -> str:
    p = urlparse(page_url)
    slug = p.path.strip("/") or "home"
    slug = slug.replace("/", "__")
    slug = re.sub(r"[^A-Za-z0-9._-]+", "-", unquote(slug)).strip("-")
    return slug[:120] or "home"


def filename_from_url(url: str) -> str:
    name = unquote(Path(urlparse(url).path).name)
    name = name.replace("/", "_").replace("\\", "_").strip()
    if not name:
        name = "image"
    # Keep original-looking spaces/punctuation, only remove filesystem-dangerous control chars.
    name = "".join(ch for ch in name if ord(ch) >= 32 and ch not in '\0')
    return name


def unique_path(
    folder: Path,
    filename: str,
    url: str,
    claimed_paths: dict[Path, str],
) -> Path:
    candidate = folder / filename
    claimed_url = claimed_paths.get(candidate)
    if claimed_url is None or claimed_url == url:
        claimed_paths[candidate] = url
        return candidate

    # Different Squarespace assets can share an uploaded filename on one page.
    # Give later collisions a deterministic URL-derived suffix so no file is lost.
    stem = candidate.stem
    suffix = candidate.suffix
    short = hashlib.sha1(url.encode("utf-8")).hexdigest()[:8]
    collision_path = folder / f"{stem}__{short}{suffix}"
    claimed_paths[collision_path] = url
    return collision_path


def crawl(session: requests.Session, start_url: str, max_pages: int = 500):
    q = deque([clean_page_url(start_url)])
    seen_pages: set[str] = set()
    asset_sources: dict[str, set[str]] = {}

    while q and len(seen_pages) < max_pages:
        page = q.popleft()
        if page in seen_pages:
            continue
        seen_pages.add(page)

        try:
            r = session.get(
                page,
                headers={"User-Agent": UA, "Accept": "text/html,application/xhtml+xml"},
                timeout=30,
            )
            r.raise_for_status()
            ctype = r.headers.get("content-type", "")
            if "html" not in ctype.lower() and "<html" not in r.text[:500].lower():
                continue
        except Exception as e:
            print(f"[page error] {page}: {e}", file=sys.stderr)
            continue

        assets, links = extract_assets_and_links(page, r.text)
        print(f"[page] {page}  images={len(assets)}")

        for asset in assets:
            asset_sources.setdefault(asset, set()).add(page)

        for link in links:
            if link not in seen_pages:
                q.append(link)

        time.sleep(0.08)

    return asset_sources, seen_pages


def download_assets(session: requests.Session, asset_sources, out_dir: Path):
    records = []
    total = len(asset_sources)
    claimed_paths: dict[Path, str] = {}

    for i, (asset_url, sources) in enumerate(sorted(asset_sources.items()), 1):
        # Put each asset under the first page where it was found.
        source_list = sorted(sources)
        source_page = source_list[0]
        folder = out_dir / page_folder(source_page)
        folder.mkdir(parents=True, exist_ok=True)

        original_name = filename_from_url(asset_url)
        dest = unique_path(folder, original_name, asset_url, claimed_paths)

        status = "downloaded"
        content_type = ""
        final_url = asset_url
        width = height = None

        try:
            # Raw CDN path without ?format=... requests the original asset.
            with session.get(asset_url, headers=HEADERS, timeout=90, stream=True, allow_redirects=True) as r:
                r.raise_for_status()
                content_type = r.headers.get("content-type", "")
                final_url = r.url

                # Don't save an HTML error page as an image.
                if "text/html" in content_type.lower():
                    raise RuntimeError(f"unexpected content-type: {content_type}")

                with open(dest, "wb") as f:
                    for chunk in r.iter_content(chunk_size=1024 * 1024):
                        if chunk:
                            f.write(chunk)

            # Optional dimension inspection with Pillow if installed.
            try:
                from PIL import Image
                with Image.open(dest) as im:
                    width, height = im.size
            except Exception:
                pass

            print(f"[{i}/{total}] {dest.relative_to(out_dir)}"
                  + (f"  {width}x{height}" if width and height else ""))

        except Exception as e:
            status = f"ERROR: {e}"
            print(f"[download error] {asset_url}: {e}", file=sys.stderr)

        records.append({
            "filename": dest.name,
            "relative_path": str(dest.relative_to(out_dir)),
            "original_asset_url": asset_url,
            "final_url": final_url,
            "source_pages": " | ".join(source_list),
            "content_type": content_type,
            "width": width or "",
            "height": height or "",
            "status": status,
        })

        time.sleep(0.08)

    return records


def write_manifests(out_dir: Path, records, pages):
    csv_path = out_dir / "manifest.csv"
    json_path = out_dir / "manifest.json"

    fieldnames = [
        "filename", "relative_path", "original_asset_url", "final_url",
        "source_pages", "content_type", "width", "height", "status"
    ]

    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(records)

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "site": START_URL,
                "pages_crawled": sorted(pages),
                "images": records,
            },
            f,
            ensure_ascii=False,
            indent=2,
        )

    return csv_path, json_path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="benbroome-squarespace-images",
                    help="Output directory (default: benbroome-squarespace-images)")
    ap.add_argument("--max-pages", type=int, default=500)
    args = ap.parse_args()

    out_dir = Path(args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    session = requests.Session()
    retries = Retry(
        total=4,
        backoff_factor=0.75,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=("GET",),
    )
    adapter = HTTPAdapter(max_retries=retries)
    session.mount("https://", adapter)
    session.mount("http://", adapter)

    print(f"Crawling {START_URL}")
    asset_sources, pages = crawl(session, START_URL, args.max_pages)
    print(f"\nFound {len(asset_sources)} unique image assets across {len(pages)} pages.\n")

    records = download_assets(session, asset_sources, out_dir)
    csv_path, json_path = write_manifests(out_dir, records, pages)

    good = sum(r["status"] == "downloaded" for r in records)
    bad = len(records) - good
    print(f"\nDone: {good} downloaded, {bad} errors.")
    print(f"Images:   {out_dir}")
    print(f"Manifest: {csv_path}")
    print(f"Manifest: {json_path}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Ben Broome / Squarespace full migration scraper
================================================

Purpose
-------
Create a local, code-friendly archive of an existing Squarespace site before
rebuilding it in Next.js / React / another coded stack.

The script crawls the public site and saves:

1. Every internal HTML page it can discover
2. Raw HTML for each page
3. Clean page content as JSON
4. A readable Markdown version of each page
5. Highest-resolution / original-looking Squarespace image assets
6. PDFs and other linked downloadable files
7. Alt text, captions, filenames, source page, dimensions, content type
8. Internal/external link inventory
9. Site-wide manifests in JSON and CSV
10. A simple Next.js-ready data file
11. A URL redirect map showing old Squarespace URLs -> proposed slugs
12. A ZIP archive of the finished migration folder

This does NOT depend on Squarespace's editor/API. It works from the public site.
If a private/unpublished Squarespace Asset Library image has never been used on
the public website, a public crawl cannot discover it.

Usage
-----
    pip install requests beautifulsoup4 pillow

    python squarespace_full_migration.py

Optional:
    python squarespace_full_migration.py \
        --site https://www.benbroome.co.uk \
        --out benbroome-migration \
        --workers 8

Notes
-----
- "Original" Squarespace image recovery:
  Squarespace often serves resized images with query parameters such as:
      ?format=1500w
      ?format=2500w
  This script removes known transformation parameters and requests the
  underlying CDN asset URL directly.

- Original uploaded filename:
  If Squarespace preserved the filename in the CDN path, we preserve it.
  If Squarespace replaced it with an opaque filename/GUID, no public scraper
  can reconstruct the old local filename; the manifest records the URL and
  discovered filename exactly as available.

- The script is intentionally conservative:
  it stays on the target domain for crawling and does not attempt to log in,
  bypass access controls, or access private Squarespace endpoints.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import csv
import hashlib
import html as html_lib
import json
import mimetypes
import os
import re
import shutil
import sys
import time
from collections import deque, defaultdict
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from urllib.parse import (
    parse_qsl,
    quote,
    unquote,
    urlencode,
    urljoin,
    urlparse,
    urlunparse,
)

import requests
from bs4 import BeautifulSoup, Tag

try:
    from PIL import Image
except Exception:
    Image = None


DEFAULT_SITE = "https://www.benbroome.co.uk/"
DEFAULT_OUT = "benbroome-squarespace-migration"

USER_AGENT = (
    "Mozilla/5.0 (compatible; SquarespaceMigrationArchive/1.0; "
    "+local-content-migration)"
)

HTML_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

ASSET_HEADERS = {
    "User-Agent": USER_AGENT,
    # Avoid explicitly preferring WebP so we have a better chance of retaining
    # the original JPEG/PNG encoding when Squarespace content-negotiates.
    "Accept": "image/jpeg,image/png,image/gif,image/tiff,image/*;q=0.9,"
              "application/pdf,*/*;q=0.5",
}

# Squarespace/CDN image transformation parameters to remove when trying to
# fetch the original underlying asset.
DROP_IMAGE_QUERY_KEYS = {
    "format",
    "width",
    "height",
    "quality",
    "crop",
    "fit",
    "auto",
    "dpr",
    "content-type",
    "contentDisposition",
    "interlace",
}

IMAGE_EXTS = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".tif", ".tiff",
    ".bmp", ".avif", ".heic", ".heif"
}

DOWNLOAD_EXTS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".zip", ".rar", ".7z", ".txt", ".rtf", ".csv",
    ".mp3", ".wav", ".aiff", ".aif", ".flac", ".m4a",
    ".mp4", ".mov", ".m4v", ".avi", ".webm",
}

NON_HTML_EXTS = IMAGE_EXTS | DOWNLOAD_EXTS

SQUARESPACE_HOST_HINTS = (
    "squarespace-cdn.com",
    "static1.squarespace.com",
    "static.squarespace.com",
)

# Things we do not want duplicated into clean text extraction.
NOISE_SELECTORS = [
    "script",
    "style",
    "noscript",
    "svg",
    "template",
    "nav",
    "header",
    "footer",
    "[role='navigation']",
    ".header",
    ".footer",
    ".sqs-announcement-bar",
    ".sqs-edit-mode-active",
    ".cookie-banner",
    ".newsletter-block",
]

TEXT_TAGS = [
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "li", "blockquote", "figcaption"
]


@dataclass
class ImageAsset:
    url: str
    filename: str
    alt: str = ""
    title: str = ""
    caption: str = ""
    source_pages: list[str] | None = None
    local_path: str = ""
    final_url: str = ""
    content_type: str = ""
    width: int | None = None
    height: int | None = None
    bytes: int | None = None
    sha256: str = ""
    status: str = "pending"


@dataclass
class DownloadAsset:
    url: str
    filename: str
    source_pages: list[str] | None = None
    local_path: str = ""
    final_url: str = ""
    content_type: str = ""
    bytes: int | None = None
    sha256: str = ""
    status: str = "pending"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def norm_space(text: str | None) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()


def clean_page_url(url: str) -> str:
    """Drop fragments/query from crawlable page URLs."""
    p = urlparse(url)
    scheme = p.scheme or "https"
    path = p.path or "/"
    return urlunparse((scheme, p.netloc.lower(), path, "", "", ""))


def canonical_asset_url(url: str) -> str:
    """Remove known Squarespace image transforms while retaining other params."""
    url = html_lib.unescape(url.strip().strip("'\""))
    p = urlparse(url)

    kept = []
    for k, v in parse_qsl(p.query, keep_blank_values=True):
        if k.lower() not in {x.lower() for x in DROP_IMAGE_QUERY_KEYS}:
            kept.append((k, v))

    return urlunparse(
        (p.scheme, p.netloc, p.path, p.params, urlencode(kept), "")
    )


def sanitize_filename(name: str, fallback: str = "asset") -> str:
    name = unquote(name or "").strip()
    name = name.replace("\\", "_").replace("/", "_")
    name = "".join(ch for ch in name if ord(ch) >= 32)
    name = re.sub(r'[<>:"|?*]', "_", name)
    name = name.strip(" .")
    if not name:
        name = fallback
    # Avoid absurd path lengths on Windows/macOS.
    if len(name) > 220:
        stem = Path(name).stem[:180]
        suffix = Path(name).suffix[:20]
        name = stem + suffix
    return name


def filename_from_url(url: str, fallback: str = "asset") -> str:
    p = urlparse(url)
    name = Path(unquote(p.path)).name
    return sanitize_filename(name, fallback=fallback)


def page_slug(url: str) -> str:
    path = unquote(urlparse(url).path.strip("/"))
    if not path:
        return "home"
    slug = path.replace("/", "__")
    slug = re.sub(r"[^A-Za-z0-9._-]+", "-", slug).strip("-")
    return slug[:180] or "page"


def section_from_url(url: str) -> str:
    parts = [x for x in urlparse(url).path.split("/") if x]
    return parts[0] if parts else "home"


def path_ext(url: str) -> str:
    return Path(urlparse(url).path).suffix.lower()


def is_probably_image_url(url: str) -> bool:
    p = urlparse(url)
    host = p.netloc.lower()
    ext = path_ext(url)
    if ext in IMAGE_EXTS:
        return True
    if any(h in host for h in SQUARESPACE_HOST_HINTS):
        # Squarespace image endpoints can have weak/no obvious extension.
        return "/content/" in p.path or "/content/v1/" in p.path
    return False


def is_downloadable_file(url: str) -> bool:
    return path_ext(url) in DOWNLOAD_EXTS


def make_unique_path(folder: Path, desired_name: str, identity: str) -> Path:
    """
    Preserve filename where possible. If two distinct URLs use same filename,
    append a short stable hash.
    """
    folder.mkdir(parents=True, exist_ok=True)
    candidate = folder / desired_name
    if not candidate.exists():
        return candidate

    stem = candidate.stem
    suffix = candidate.suffix
    short = hashlib.sha1(identity.encode("utf-8")).hexdigest()[:8]
    return folder / f"{stem}__{short}{suffix}"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def content_root(soup: BeautifulSoup) -> Tag:
    """
    Pick the most likely meaningful content root.
    Squarespace themes vary; prefer main/article/page container before body.
    """
    for selector in (
        "main",
        "article",
        "#page",
        "#siteWrapper main",
        ".Main-content",
        ".page-section",
        "body",
    ):
        node = soup.select_one(selector)
        if node:
            return node
    return soup


def remove_noise(soup: BeautifulSoup) -> None:
    for selector in NOISE_SELECTORS:
        for node in soup.select(selector):
            node.decompose()


def meta_content(soup: BeautifulSoup, selector: str) -> str:
    tag = soup.select_one(selector)
    if not tag:
        return ""
    return norm_space(tag.get("content", ""))


def extract_srcset(value: str) -> list[str]:
    """
    Basic srcset parser:
        "url1 300w, url2 750w" -> [url1, url2]
    """
    out: list[str] = []
    for piece in value.split(","):
        piece = piece.strip()
        if not piece:
            continue
        out.append(piece.split()[0])
    return out


def infer_caption(img: Tag) -> str:
    # figcaption is most semantically useful.
    fig = img.find_parent("figure")
    if fig:
        cap = fig.find("figcaption")
        if cap:
            return norm_space(cap.get_text(" ", strip=True))

    # Squarespace may store captions around image blocks.
    parent = img.parent
    for _ in range(3):
        if not parent or not isinstance(parent, Tag):
            break
        for selector in (
            ".image-caption",
            ".image-caption-wrapper",
            ".sqs-image-caption",
            ".image-block-caption",
        ):
            cap = parent.select_one(selector)
            if cap:
                return norm_space(cap.get_text(" ", strip=True))
        parent = parent.parent

    return ""


def extract_images(page_url: str, soup: BeautifulSoup) -> list[dict]:
    found: dict[str, dict] = {}

    # <img> elements
    for img in soup.find_all("img"):
        candidates: list[str] = []

        for attr in (
            "src",
            "data-src",
            "data-image",
            "data-image-url",
            "data-url",
            "data-load",
        ):
            value = img.get(attr)
            if value:
                candidates.append(value)

        for attr in ("srcset", "data-srcset"):
            value = img.get(attr)
            if value:
                candidates.extend(extract_srcset(value))

        if not candidates:
            continue

        normalized: list[str] = []
        for raw in candidates:
            u = canonical_asset_url(urljoin(page_url, raw))
            if is_probably_image_url(u):
                normalized.append(u)

        if not normalized:
            continue

        # Prefer a canonical Squarespace URL with the shortest query/path noise.
        normalized = sorted(set(normalized), key=lambda x: (len(urlparse(x).query), len(x)))
        asset_url = normalized[0]

        info = found.setdefault(
            asset_url,
            {
                "url": asset_url,
                "filename": filename_from_url(asset_url, "image"),
                "alt": "",
                "title": "",
                "caption": "",
            },
        )

        info["alt"] = info["alt"] or norm_space(img.get("alt", ""))
        info["title"] = info["title"] or norm_space(img.get("title", ""))
        info["caption"] = info["caption"] or infer_caption(img)

    # OpenGraph/Twitter previews may expose images missed by DOM scraping.
    for selector in (
        'meta[property="og:image"]',
        'meta[property="og:image:secure_url"]',
        'meta[name="twitter:image"]',
    ):
        for tag in soup.select(selector):
            raw = tag.get("content")
            if not raw:
                continue
            u = canonical_asset_url(urljoin(page_url, raw))
            if is_probably_image_url(u):
                found.setdefault(
                    u,
                    {
                        "url": u,
                        "filename": filename_from_url(u, "image"),
                        "alt": "",
                        "title": "",
                        "caption": "",
                    },
                )

    # Direct links to full-size images.
    for a in soup.find_all("a", href=True):
        u = canonical_asset_url(urljoin(page_url, a["href"]))
        if is_probably_image_url(u):
            found.setdefault(
                u,
                {
                    "url": u,
                    "filename": filename_from_url(u, "image"),
                    "alt": norm_space(a.get_text(" ", strip=True)),
                    "title": "",
                    "caption": "",
                },
            )

    # Squarespace occasionally stores asset URLs inside script/style JSON.
    raw_html = str(soup)
    pattern = re.compile(
        r'https?:\\?/\\?/(?:images\.squarespace-cdn\.com|static1?\.squarespace\.com)'
        r'[^"\'<>\s)]+',
        re.I,
    )
    for match in pattern.findall(raw_html):
        u = html_lib.unescape(match.replace("\\/", "/")).rstrip("\\,;")
        u = canonical_asset_url(u)
        if is_probably_image_url(u):
            found.setdefault(
                u,
                {
                    "url": u,
                    "filename": filename_from_url(u, "image"),
                    "alt": "",
                    "title": "",
                    "caption": "",
                },
            )

    return list(found.values())


def extract_links(page_url: str, soup: BeautifulSoup, allowed_hosts: set[str]) -> list[dict]:
    result: list[dict] = []
    seen: set[tuple[str, str]] = set()

    for a in soup.find_all("a", href=True):
        raw = a.get("href", "").strip()
        if not raw or raw.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue

        u = urljoin(page_url, raw)
        p = urlparse(u)
        text = norm_space(a.get_text(" ", strip=True))

        if is_downloadable_file(u):
            kind = "file"
        elif is_probably_image_url(u):
            kind = "image"
        elif p.netloc.lower() in allowed_hosts:
            kind = "internal"
        else:
            kind = "external"

        key = (u, text)
        if key in seen:
            continue
        seen.add(key)

        result.append({
            "text": text,
            "url": u,
            "kind": kind,
        })

    return result


def extract_text_blocks(soup: BeautifulSoup) -> list[dict]:
    clean = BeautifulSoup(str(soup), "html.parser")
    remove_noise(clean)
    root = content_root(clean)

    blocks: list[dict] = []
    seen: set[str] = set()

    for node in root.find_all(TEXT_TAGS, recursive=True):
        text = norm_space(node.get_text(" ", strip=True))
        if not text:
            continue

        # Avoid exact duplicates produced by nested Squarespace wrappers.
        duplicate_key = f"{node.name}:{text}"
        if duplicate_key in seen:
            continue
        seen.add(duplicate_key)

        classes = " ".join(node.get("class", []))
        blocks.append({
            "type": node.name,
            "text": text,
            "class": classes,
        })

    return blocks


def extract_jsonld(soup: BeautifulSoup) -> list[dict | list]:
    result = []
    for script in soup.find_all("script", type="application/ld+json"):
        raw = script.string or script.get_text()
        raw = raw.strip()
        if not raw:
            continue
        try:
            result.append(json.loads(raw))
        except Exception:
            pass
    return result


def extract_page_data(
    session: requests.Session,
    url: str,
    allowed_hosts: set[str],
) -> tuple[dict, str]:
    r = session.get(url, headers=HTML_HEADERS, timeout=45, allow_redirects=True)
    r.raise_for_status()

    ctype = r.headers.get("content-type", "")
    if "html" not in ctype.lower() and "<html" not in r.text[:1000].lower():
        raise RuntimeError(f"Not HTML ({ctype})")

    final_url = clean_page_url(r.url)
    soup = BeautifulSoup(r.text, "html.parser")

    title = norm_space(soup.title.get_text(" ", strip=True)) if soup.title else ""
    canonical_tag = soup.select_one('link[rel="canonical"]')
    canonical = (
        canonical_tag.get("href", "").strip()
        if canonical_tag else final_url
    )

    blocks = extract_text_blocks(soup)
    images = extract_images(final_url, soup)
    links = extract_links(final_url, soup, allowed_hosts)

    h1 = [b["text"] for b in blocks if b["type"] == "h1"]
    h2 = [b["text"] for b in blocks if b["type"] == "h2"]

    page = {
        "url": url,
        "final_url": final_url,
        "canonical_url": canonical,
        "slug": page_slug(final_url),
        "section": section_from_url(final_url),
        "http_status": r.status_code,
        "content_type": ctype,
        "title": title,
        "meta_description": meta_content(soup, 'meta[name="description"]'),
        "og_title": meta_content(soup, 'meta[property="og:title"]'),
        "og_description": meta_content(soup, 'meta[property="og:description"]'),
        "h1": h1,
        "h2": h2,
        "blocks": blocks,
        "text": "\n\n".join(b["text"] for b in blocks),
        "images": images,
        "links": links,
        "jsonld": extract_jsonld(soup),
        "scraped_at": now_iso(),
    }
    return page, r.text


def markdown_for_page(page: dict) -> str:
    lines = [
        "---",
        f'url: {json.dumps(page["final_url"], ensure_ascii=False)}',
        f'slug: {json.dumps(page["slug"], ensure_ascii=False)}',
        f'section: {json.dumps(page["section"], ensure_ascii=False)}',
        f'title: {json.dumps(page["title"], ensure_ascii=False)}',
        "---",
        "",
    ]

    for block in page["blocks"]:
        typ = block["type"]
        text = block["text"]

        if typ == "h1":
            lines.extend([f"# {text}", ""])
        elif typ == "h2":
            lines.extend([f"## {text}", ""])
        elif typ == "h3":
            lines.extend([f"### {text}", ""])
        elif typ == "h4":
            lines.extend([f"#### {text}", ""])
        elif typ == "h5":
            lines.extend([f"##### {text}", ""])
        elif typ == "h6":
            lines.extend([f"###### {text}", ""])
        elif typ == "li":
            lines.append(f"- {text}")
        elif typ == "blockquote":
            lines.extend([f"> {text}", ""])
        elif typ == "figcaption":
            lines.extend([f"*{text}*", ""])
        else:
            lines.extend([text, ""])

    if page["images"]:
        lines.extend(["", "## Images", ""])
        for img in page["images"]:
            label = img["alt"] or img["caption"] or img["filename"]
            lines.append(f'- {label}: {img["url"]}')

    relevant_links = [
        x for x in page["links"]
        if x["kind"] in ("external", "file")
    ]
    if relevant_links:
        lines.extend(["", "## External links / files", ""])
        for link in relevant_links:
            label = link["text"] or link["url"]
            lines.append(f'- [{label}]({link["url"]})')

    return "\n".join(lines).strip() + "\n"


def discover_from_sitemap(
    session: requests.Session,
    site_root: str,
    allowed_hosts: set[str],
) -> set[str]:
    """
    Try common sitemap endpoints to capture pages not linked from navigation.
    Handles sitemap indexes recursively one level at a time.
    """
    discovered: set[str] = set()
    visited_sitemaps: set[str] = set()
    queue = deque([
        urljoin(site_root, "/sitemap.xml"),
        urljoin(site_root, "/sitemap_index.xml"),
    ])

    while queue:
        sm_url = queue.popleft()
        if sm_url in visited_sitemaps:
            continue
        visited_sitemaps.add(sm_url)

        try:
            r = session.get(sm_url, headers=HTML_HEADERS, timeout=30)
            if r.status_code != 200:
                continue
            text = r.text
        except Exception:
            continue

        # XML parsing via BeautifulSoup avoids an lxml dependency.
        soup = BeautifulSoup(text, "xml")
        locs = [norm_space(x.get_text()) for x in soup.find_all("loc")]

        for loc in locs:
            if not loc:
                continue
            p = urlparse(loc)
            if p.netloc.lower() not in allowed_hosts:
                continue

            if p.path.lower().endswith(".xml"):
                queue.append(loc)
                continue

            if path_ext(loc) not in NON_HTML_EXTS:
                discovered.add(clean_page_url(loc))

    return discovered


def download_binary(
    session: requests.Session,
    url: str,
    out_folder: Path,
    desired_name: str,
) -> dict:
    result = {
        "url": url,
        "filename": desired_name,
        "local_path": "",
        "final_url": "",
        "content_type": "",
        "bytes": None,
        "sha256": "",
        "width": None,
        "height": None,
        "status": "pending",
    }

    try:
        dest = make_unique_path(out_folder, desired_name, url)

        with session.get(
            url,
            headers=ASSET_HEADERS,
            timeout=120,
            stream=True,
            allow_redirects=True,
        ) as r:
            r.raise_for_status()
            result["final_url"] = r.url
            result["content_type"] = r.headers.get("content-type", "")

            # Do not save HTML errors as binary assets.
            if "text/html" in result["content_type"].lower():
                raise RuntimeError(
                    f"Server returned HTML rather than asset "
                    f"({result['content_type']})"
                )

            with dest.open("wb") as f:
                for chunk in r.iter_content(chunk_size=1024 * 1024):
                    if chunk:
                        f.write(chunk)

        result["local_path"] = str(dest)
        result["bytes"] = dest.stat().st_size
        result["sha256"] = sha256_file(dest)

        if Image is not None:
            try:
                with Image.open(dest) as im:
                    result["width"], result["height"] = im.size
            except Exception:
                pass

        result["status"] = "downloaded"

    except Exception as exc:
        result["status"] = f"ERROR: {exc}"

    return result


def write_csv(path: Path, rows: list[dict], fields: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Full Squarespace site migration scraper."
    )
    parser.add_argument(
        "--site",
        default=DEFAULT_SITE,
        help=f"Squarespace site root (default: {DEFAULT_SITE})",
    )
    parser.add_argument(
        "--out",
        default=DEFAULT_OUT,
        help=f"Output directory (default: {DEFAULT_OUT})",
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=1000,
        help="Safety cap for HTML pages (default: 1000)",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=6,
        help="Concurrent asset download workers (default: 6)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.10,
        help="Delay between page requests in seconds (default: 0.10)",
    )
    parser.add_argument(
        "--no-zip",
        action="store_true",
        help="Do not create a final ZIP archive.",
    )
    args = parser.parse_args()

    site_root = args.site.rstrip("/") + "/"
    root_parsed = urlparse(site_root)
    canonical_host = root_parsed.netloc.lower()
    bare_host = canonical_host.removeprefix("www.")
    allowed_hosts = {canonical_host, bare_host, "www." + bare_host}

    out = Path(args.out).resolve()
    raw_html_dir = out / "raw_html"
    pages_json_dir = out / "pages"
    markdown_dir = out / "markdown"
    images_dir = out / "media" / "images"
    files_dir = out / "media" / "files"
    manifests_dir = out / "manifests"
    nextjs_dir = out / "nextjs"

    for folder in (
        raw_html_dir,
        pages_json_dir,
        markdown_dir,
        images_dir,
        files_dir,
        manifests_dir,
        nextjs_dir,
    ):
        folder.mkdir(parents=True, exist_ok=True)

    session = requests.Session()

    print("=" * 72)
    print("Squarespace full migration scraper")
    print("=" * 72)
    print(f"Site:   {site_root}")
    print(f"Output: {out}")
    print()

    # ---------------------------------------------------------------------
    # STEP 1: discover pages
    # ---------------------------------------------------------------------
    print("[1/7] Discovering pages from sitemap...")
    sitemap_pages = discover_from_sitemap(session, site_root, allowed_hosts)
    print(f"      Found {len(sitemap_pages)} URLs from sitemap(s).")

    queue = deque([clean_page_url(site_root)])
    for u in sorted(sitemap_pages):
        if u != clean_page_url(site_root):
            queue.append(u)

    visited: set[str] = set()
    pages: list[dict] = []
    page_errors: list[dict] = []

    # URL -> metadata, plus source pages set
    image_map: dict[str, dict] = {}
    image_sources: dict[str, set[str]] = defaultdict(set)

    file_map: dict[str, dict] = {}
    file_sources: dict[str, set[str]] = defaultdict(set)

    link_rows: list[dict] = []

    # ---------------------------------------------------------------------
    # STEP 2: crawl pages and extract content
    # ---------------------------------------------------------------------
    print("[2/7] Crawling HTML pages and extracting content...")

    while queue and len(visited) < args.max_pages:
        url = queue.popleft()
        if url in visited:
            continue
        if urlparse(url).netloc.lower() not in allowed_hosts:
            continue
        if path_ext(url) in NON_HTML_EXTS:
            continue

        visited.add(url)

        try:
            page, raw_html = extract_page_data(session, url, allowed_hosts)
        except Exception as exc:
            page_errors.append({
                "url": url,
                "error": str(exc),
            })
            print(f"      [ERROR] {url}: {exc}")
            continue

        pages.append(page)

        slug = page["slug"]
        (raw_html_dir / f"{slug}.html").write_text(
            raw_html,
            encoding="utf-8",
            errors="replace",
        )
        (pages_json_dir / f"{slug}.json").write_text(
            json.dumps(page, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        (markdown_dir / f"{slug}.md").write_text(
            markdown_for_page(page),
            encoding="utf-8",
        )

        print(
            f"      [PAGE] {page['final_url']} | "
            f"text={len(page['blocks'])} blocks | "
            f"images={len(page['images'])} | "
            f"links={len(page['links'])}"
        )

        # Merge image metadata across pages.
        for img in page["images"]:
            u = img["url"]
            image_sources[u].add(page["final_url"])

            if u not in image_map:
                image_map[u] = dict(img)
            else:
                for key in ("alt", "title", "caption"):
                    if not image_map[u].get(key) and img.get(key):
                        image_map[u][key] = img[key]

        # Links: discover more internal pages + downloadable files.
        for link in page["links"]:
            link_rows.append({
                "source_page": page["final_url"],
                **link,
            })

            if link["kind"] == "internal":
                target = clean_page_url(link["url"])
                if (
                    urlparse(target).netloc.lower() in allowed_hosts
                    and path_ext(target) not in NON_HTML_EXTS
                    and target not in visited
                ):
                    queue.append(target)

            elif link["kind"] == "file":
                u = link["url"]
                file_sources[u].add(page["final_url"])
                if u not in file_map:
                    file_map[u] = {
                        "url": u,
                        "filename": filename_from_url(u, "file"),
                    }

        time.sleep(max(0, args.delay))

    print(f"      Crawled {len(pages)} HTML pages.")
    if page_errors:
        print(f"      Page errors: {len(page_errors)}")

    # ---------------------------------------------------------------------
    # STEP 3: download images at canonical/original-looking URL
    # ---------------------------------------------------------------------
    print("[3/7] Downloading original/highest-resolution images...")
    image_urls = sorted(image_map.keys())
    image_results: list[dict] = []

    def image_job(u: str):
        meta = image_map[u]
        result = download_binary(
            requests.Session(),
            u,
            images_dir,
            meta["filename"],
        )
        result.update({
            "alt": meta.get("alt", ""),
            "title": meta.get("title", ""),
            "caption": meta.get("caption", ""),
            "source_pages": sorted(image_sources[u]),
        })
        return result

    if image_urls:
        with concurrent.futures.ThreadPoolExecutor(
            max_workers=max(1, args.workers)
        ) as pool:
            futures = {pool.submit(image_job, u): u for u in image_urls}
            done = 0
            for future in concurrent.futures.as_completed(futures):
                result = future.result()
                image_results.append(result)
                done += 1

                dims = ""
                if result.get("width") and result.get("height"):
                    dims = f" {result['width']}x{result['height']}"

                print(
                    f"      [{done}/{len(image_urls)}] "
                    f"{result['filename']}{dims} -> {result['status']}"
                )

    # Deduplicate identical image bytes while preserving every URL in manifest.
    hash_to_path: dict[str, str] = {}
    for item in sorted(image_results, key=lambda x: x.get("url", "")):
        h = item.get("sha256")
        lp = item.get("local_path")
        if not h or not lp or item.get("status") != "downloaded":
            continue

        if h not in hash_to_path:
            hash_to_path[h] = lp
            item["duplicate_of"] = ""
        else:
            item["duplicate_of"] = hash_to_path[h]

    # ---------------------------------------------------------------------
    # STEP 4: download PDFs / other files
    # ---------------------------------------------------------------------
    print("[4/7] Downloading PDFs and other linked files...")
    file_urls = sorted(file_map.keys())
    file_results: list[dict] = []

    def file_job(u: str):
        meta = file_map[u]
        result = download_binary(
            requests.Session(),
            u,
            files_dir,
            meta["filename"],
        )
        result["source_pages"] = sorted(file_sources[u])
        return result

    if file_urls:
        with concurrent.futures.ThreadPoolExecutor(
            max_workers=max(1, args.workers)
        ) as pool:
            futures = {pool.submit(file_job, u): u for u in file_urls}
            done = 0
            for future in concurrent.futures.as_completed(futures):
                result = future.result()
                file_results.append(result)
                done += 1
                print(
                    f"      [{done}/{len(file_urls)}] "
                    f"{result['filename']} -> {result['status']}"
                )

    # ---------------------------------------------------------------------
    # STEP 5: write site-wide manifests
    # ---------------------------------------------------------------------
    print("[5/7] Writing migration manifests...")

    # Map local media paths into repo-friendly public URLs.
    image_lookup = {}
    for item in image_results:
        if item.get("status") != "downloaded":
            continue
        lp = Path(item["local_path"])
        try:
            rel = lp.relative_to(out)
        except Exception:
            rel = lp
        image_lookup[item["url"]] = "/" + str(rel).replace(os.sep, "/")

    file_lookup = {}
    for item in file_results:
        if item.get("status") != "downloaded":
            continue
        lp = Path(item["local_path"])
        try:
            rel = lp.relative_to(out)
        except Exception:
            rel = lp
        file_lookup[item["url"]] = "/" + str(rel).replace(os.sep, "/")

    # Enrich pages with local asset mappings.
    enriched_pages = []
    for page in pages:
        p = json.loads(json.dumps(page))

        for img in p["images"]:
            img["local_public_path"] = image_lookup.get(img["url"], "")

        for link in p["links"]:
            if link["kind"] == "file":
                link["local_public_path"] = file_lookup.get(link["url"], "")

        enriched_pages.append(p)

    site_manifest = {
        "migration": {
            "source_site": site_root,
            "created_at": now_iso(),
            "pages_crawled": len(enriched_pages),
            "images_discovered": len(image_urls),
            "files_discovered": len(file_urls),
            "page_errors": len(page_errors),
        },
        "pages": enriched_pages,
        "images": sorted(image_results, key=lambda x: x.get("url", "")),
        "files": sorted(file_results, key=lambda x: x.get("url", "")),
        "page_errors": page_errors,
    }

    (out / "site.json").write_text(
        json.dumps(site_manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # Compact Next.js-friendly version.
    next_pages = []
    for page in enriched_pages:
        next_pages.append({
            "slug": page["slug"],
            "section": page["section"],
            "url": page["final_url"],
            "title": page["title"],
            "description": page["meta_description"],
            "h1": page["h1"],
            "blocks": page["blocks"],
            "images": [
                {
                    "src": img.get("local_public_path") or img["url"],
                    "originalUrl": img["url"],
                    "filename": img["filename"],
                    "alt": img.get("alt", ""),
                    "caption": img.get("caption", ""),
                }
                for img in page["images"]
            ],
            "links": page["links"],
        })

    (nextjs_dir / "content.json").write_text(
        json.dumps({"pages": next_pages}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # Redirect table for preserving SEO/old URLs.
    redirects = []
    for page in sorted(enriched_pages, key=lambda x: x["final_url"]):
        old_path = urlparse(page["final_url"]).path or "/"
        new_path = "/" if page["slug"] == "home" else f"/{page['slug']}"
        redirects.append({
            "old_url": page["final_url"],
            "old_path": old_path,
            "suggested_new_path": new_path,
        })

    write_csv(
        manifests_dir / "pages.csv",
        [
            {
                "url": p["final_url"],
                "canonical_url": p["canonical_url"],
                "slug": p["slug"],
                "section": p["section"],
                "title": p["title"],
                "meta_description": p["meta_description"],
                "image_count": len(p["images"]),
                "link_count": len(p["links"]),
                "text_blocks": len(p["blocks"]),
            }
            for p in enriched_pages
        ],
        [
            "url", "canonical_url", "slug", "section", "title",
            "meta_description", "image_count", "link_count", "text_blocks"
        ],
    )

    write_csv(
        manifests_dir / "images.csv",
        image_results,
        [
            "url", "final_url", "filename", "local_path",
            "content_type", "width", "height", "bytes", "sha256",
            "alt", "title", "caption", "source_pages", "duplicate_of", "status"
        ],
    )

    write_csv(
        manifests_dir / "files.csv",
        file_results,
        [
            "url", "final_url", "filename", "local_path",
            "content_type", "bytes", "sha256", "source_pages", "status"
        ],
    )

    write_csv(
        manifests_dir / "links.csv",
        link_rows,
        ["source_page", "text", "url", "kind"],
    )

    write_csv(
        manifests_dir / "redirects.csv",
        redirects,
        ["old_url", "old_path", "suggested_new_path"],
    )

    write_csv(
        manifests_dir / "page_errors.csv",
        page_errors,
        ["url", "error"],
    )

    # A quick human-readable inventory.
    inventory_lines = [
        "# Ben Broome Squarespace migration inventory",
        "",
        f"- Source: {site_root}",
        f"- Generated: {now_iso()}",
        f"- HTML pages: {len(enriched_pages)}",
        f"- Unique image URLs: {len(image_urls)}",
        f"- Downloadable linked files: {len(file_urls)}",
        f"- Page errors: {len(page_errors)}",
        "",
        "## Sections",
        "",
    ]

    counts = defaultdict(int)
    for page in enriched_pages:
        counts[page["section"]] += 1

    for section, count in sorted(counts.items()):
        inventory_lines.append(f"- {section}: {count} page(s)")

    inventory_lines.extend([
        "",
        "## Important files",
        "",
        "- `site.json`: complete migration data",
        "- `nextjs/content.json`: compact code-friendly page data",
        "- `media/images/`: downloaded Squarespace images",
        "- `media/files/`: PDFs and other linked files",
        "- `pages/`: one JSON file per page",
        "- `markdown/`: one readable Markdown file per page",
        "- `raw_html/`: original page HTML snapshots",
        "- `manifests/images.csv`: image source/provenance/dimensions",
        "- `manifests/files.csv`: file source/provenance",
        "- `manifests/links.csv`: all links",
        "- `manifests/redirects.csv`: old URL -> proposed new path",
        "",
        "## Caveat",
        "",
        "Images that exist only in Squarespace's private Asset Library and are "
        "not referenced by any public page cannot be discovered by this crawler.",
        "",
    ])

    (out / "INVENTORY.md").write_text(
        "\n".join(inventory_lines),
        encoding="utf-8",
    )

    # ---------------------------------------------------------------------
    # STEP 6: copy media into a ready-to-drop Next.js public directory
    # ---------------------------------------------------------------------
    print("[6/7] Preparing Next.js-ready public asset folder...")
    next_public = nextjs_dir / "public" / "media"
    next_images = next_public / "images"
    next_files = next_public / "files"

    if next_images.exists():
        shutil.rmtree(next_images)
    if next_files.exists():
        shutil.rmtree(next_files)

    if images_dir.exists():
        shutil.copytree(images_dir, next_images)
    if files_dir.exists():
        shutil.copytree(files_dir, next_files)

    # ---------------------------------------------------------------------
    # STEP 7: ZIP
    # ---------------------------------------------------------------------
    print("[7/7] Finalizing archive...")
    zip_path = None
    if not args.no_zip:
        zip_path = shutil.make_archive(
            str(out),
            "zip",
            root_dir=out.parent,
            base_dir=out.name,
        )

    good_images = sum(x.get("status") == "downloaded" for x in image_results)
    bad_images = len(image_results) - good_images
    good_files = sum(x.get("status") == "downloaded" for x in file_results)
    bad_files = len(file_results) - good_files

    print()
    print("=" * 72)
    print("Migration complete")
    print("=" * 72)
    print(f"Pages:             {len(enriched_pages)}")
    print(f"Images downloaded: {good_images}")
    print(f"Image errors:       {bad_images}")
    print(f"Files downloaded:   {good_files}")
    print(f"File errors:        {bad_files}")
    print(f"Page errors:        {len(page_errors)}")
    print()
    print(f"Folder: {out}")
    print(f"Main data: {out / 'site.json'}")
    print(f"Next.js data: {nextjs_dir / 'content.json'}")
    if zip_path:
        print(f"ZIP: {zip_path}")
    print()
    print("Recommended next step:")
    print("Upload the generated ZIP/folder into ChatGPT or your repo so the raw")
    print("Squarespace output can be normalized into the final Ben portfolio schema.")
    print("=" * 72)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Turn the Squarespace migration dump into grouped Next.js portfolio data."""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "benbroome-squarespace-migration"
GROUPED = ROOT / "benbroome-squarespace-images"
CONTENT = json.loads((MIGRATION / "nextjs" / "content.json").read_text(encoding="utf-8"))
MEDIA = MIGRATION / "media" / "images"
FILES = MIGRATION / "media" / "files"
PUBLIC_WORK = ROOT / "public" / "work"
PUBLIC_FILES = ROOT / "public" / "files"
OUT_JSON = ROOT / "lib" / "works.json"

SKIP_PAGES = {
    "home",
    "cart",
    "exhibition",
    "performance",
    "writing",
    "press",
    "artistgrant",
    "artist-grant",
}

SKIP_NAME_RE = re.compile(
    r"(favicon|pixel\.gif|_thumbnail|thumbnail)",
    re.I,
)
YEAR_RE = re.compile(r"(19|20)\d{2}")

EXHIBITION_ORDER = [
    "exhibition__ladjidiaby",
    "exhibition__cypriengaillard",
    "exhibition__themagicpencil",
    "exhibition__artistmembershipproject",
    "exhibition__ben-broome-after-pheidias-galerie-derouillon-paris-2025-yh9j8",
    "exhibition__racheal-crowthergebrauchsmusik-galerie-noah-klink",
    "exhibition__david-l-johnson-from-the-street-i-can-see-the-moon",
    "exhibition__claudia-comte-home-sweet-home",
    "exhibition__gala-prudent-concerto-of-the-periphery",
    "exhibition__jesus-hilario-reyes-waywardly-in-low-tide",
    "exhibition__stephanie-brossard-notre-dame-des-laves",
    "exhibition__christelle-oyiri-hyperfate",
    "exhibition__lenard-giller-revisions",
    "exhibition__newyork2022",
    "exhibition__drawing-a-blank-parasol-unit",
    "exhibition__paris2020",
    "exhibition__aspen-kincaid",
    "exhibition__london2019",
    "exhibition__newyork2018",
]

PERFORMANCE_ORDER = [
    "klein",
    "ratsection",
    "suutoo",
    "showmethebody",
    "slauson-malone-1-2025",
    "charlieosbourne",
    "dariablum",
    "chassol",
    "eartheater",
    "gabbereleganza",
    "jesushilarioreyes",
    "johnglacier",
    "slauson-malone",
    "tygapaw",
    "keiyaa",
    "laraaji",
    "drawing-a-blank-parasol-unit-1",
    "slausonmalonelondon",
    "drawingablankparis",
    "chassolparis",
    "space-afrika",
    "drawing-a-blank-parasol-unit-1-1",
]

GRANT_ORDER = [
    "artistgrant__2022grant",
    "artistgrant__2021grant",
]


def slugify(text: str) -> str:
    text = text.lower().replace("’", "'")
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text[:80] or "item"


def clean_title(page: dict) -> str:
    title = (page.get("title") or "").replace(" — Ben Broome", "").strip()
    for block in page.get("blocks") or []:
        if block.get("type") in {"h1", "h2", "h3"} and block.get("text"):
            text = block["text"].strip()
            if text.lower() not in {"press", "artist grant", "exhibitions & projects"}:
                return text
    return title or page["slug"]


def extract_year(text: str, fallback: int = 0) -> int:
    years = [int(y) for y in re.findall(r"(?:19|20)\d{2}", text or "")]
    return years[-1] if years else fallback


def split_listing(title: str, category: str) -> tuple[str, str, str, int]:
    year = extract_year(title)
    date = str(year) if year else ""
    body = re.sub(r",?\s*(?:19|20)\d{2}\s*$", "", title).strip(" ,")
    parts = [p.strip() for p in body.split(",") if p.strip()]
    if category == "Performance":
        venue = parts[-1] if len(parts) > 1 else ""
        name = ", ".join(parts[:-1]) if len(parts) > 1 else body
        return name or title, venue, date, year
    if len(parts) >= 3:
        return ", ".join(parts[:-2]), ", ".join(parts[-2:]), date, year
    if len(parts) == 2:
        return parts[0], parts[1], date, year
    return body or title, "", date, year


def description_from(page: dict) -> str:
    skip = {clean_title(page).lower()}
    chunks: list[str] = []
    seen: set[str] = set()
    for block in page.get("blocks") or []:
        text = (block.get("text") or "").strip()
        key = re.sub(r"\s+", " ", text).lower()
        if not text or key in seen or key in skip:
            continue
        if block.get("type") in {"h1", "h2", "h3", "p", "blockquote", "li"}:
            seen.add(key)
            chunks.append(text)
    # Drop near-duplicate caption/heading pairs from Squarespace galleries.
    compact: list[str] = []
    for chunk in chunks:
        if compact and chunk.lower() == compact[-1].lower():
            continue
        compact.append(chunk)
    return "\n\n".join(compact[:12])


def is_noise_image(name: str) -> bool:
    return bool(SKIP_NAME_RE.search(name)) or name.lower() in {"favicon.ico"}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def grouped_dir_for(slug: str) -> Path | None:
    candidate = GROUPED / slug
    if candidate.is_dir():
        return candidate
    return None


def collect_images(page: dict) -> list[Path]:
    slug = page["slug"]
    chosen: list[Path] = []
    seen_hash: set[str] = set()
    names_with_full: set[str] = set()

    for img in page.get("images") or []:
        filename = unquote(img.get("filename") or "")
        if filename and "thumbnail" not in filename.lower():
            names_with_full.add(Path(filename).stem.replace("_THUMBNAIL", "").replace("_thumbnail", "").lower())

    def accept(path: Path) -> bool:
        if not path.is_file() or is_noise_image(path.name):
            return False
        if path.stat().st_size < 2000:
            return False
        digest = sha256(path)
        if digest in seen_hash:
            return False
        seen_hash.add(digest)
        chosen.append(path)
        return True

    grouped = grouped_dir_for(slug)
    # Prefer the live-page image order from the scrape, resolved against grouped files first.
    grouped_by_name = {}
    if grouped:
        for path in grouped.iterdir():
            if path.is_file():
                grouped_by_name[path.name.lower()] = path
                grouped_by_name[unquote(path.name).lower()] = path

    for img in page.get("images") or []:
        filename = unquote(img.get("filename") or Path(urlparse(img.get("originalUrl") or img.get("src") or "").path).name)
        if not filename or is_noise_image(filename):
            continue
        stem = Path(filename).stem.lower()
        if "thumbnail" in stem and stem.replace("_thumbnail", "") in names_with_full:
            continue

        candidates = []
        if grouped:
            for key in (filename.lower(), filename.replace("+", " ").lower(), unquote(filename).lower()):
                if key in grouped_by_name:
                    candidates.append(grouped_by_name[key])
        src = img.get("src") or ""
        local = MIGRATION / src.lstrip("/").replace("/", os.sep)
        if not local.exists() and filename:
            local = MEDIA / filename
        if local.exists():
            candidates.append(local)

        for candidate in candidates:
            if accept(candidate):
                break

    if not chosen and grouped:
        for path in sorted(grouped.iterdir()):
            accept(path)

    return chosen


def copy_images(slug: str, paths: list[Path], alt: str) -> list[dict]:
    dest_dir = PUBLIC_WORK / slug
    if dest_dir.exists():
        shutil.rmtree(dest_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)
    images = []
    for index, src in enumerate(paths, start=1):
        suffix = src.suffix.lower() or ".jpg"
        name = f"{index:03d}{suffix}"
        dest = dest_dir / name
        shutil.copy2(src, dest)
        images.append({
            "src": f"/work/{slug}/{name}",
            "alt": alt,
            "originalName": src.name,
        })
    return images


def copy_page_files(page: dict) -> list[dict]:
    PUBLIC_FILES.mkdir(parents=True, exist_ok=True)
    files = []
    seen = set()
    for link in page.get("links") or []:
        if link.get("kind") != "file":
            continue
        url = link.get("url") or ""
        name = Path(unquote(urlparse(url).path)).name
        if not name or name in seen:
            continue
        src = FILES / name
        if not src.exists():
            continue
        seen.add(name)
        dest = PUBLIC_FILES / name
        if not dest.exists():
            shutil.copy2(src, dest)
        files.append({
            "label": link.get("text") or name,
            "href": f"/files/{name}",
        })
    return files


def page_by_slug() -> dict[str, dict]:
    return {page["slug"]: page for page in CONTENT["pages"]}


def work_from_page(page: dict, category: str, order: int, listing_title: str | None = None) -> dict:
    public_slug = page["slug"].replace("__", "-")
    title = listing_title or clean_title(page)
    name, venue, date, year = split_listing(title, category)
    images = copy_images(public_slug, collect_images(page), name)
    files = copy_page_files(page)
    href = None
    if category in {"Selected Writing", "Press"}:
        href = next(
            (
                link["url"]
                for link in page.get("links") or []
                if link.get("kind") == "external" and "instagram.com" not in (link.get("url") or "")
            ),
            None,
        )
    return {
        "slug": public_slug,
        "sourceSlug": page["slug"],
        "title": name,
        "type": category if category != "Selected Writing" else "Writing",
        "publication": venue,
        "date": date,
        "year": year,
        "description": description_from(page),
        "images": images,
        "files": files,
        "externalHref": href,
        "featuredImage": images[0]["src"] if images else "",
        "order": order,
        "category": category,
        "sourceUrl": page.get("url") or "",
    }


def writing_items(page: dict, start_order: int) -> list[dict]:
    titles = [b["text"] for b in page.get("blocks") or [] if b.get("type") == "h1"]
    links = [
        link for link in page.get("links") or []
        if link.get("kind") in {"external", "file"}
        and "instagram.com" not in (link.get("url") or "")
    ]
    items = []
    used = set()
    known_file_corrections = {
        "exhibitiontextlenardgiller": "Revisions-press-release.pdf",
    }
    def signature(value: str) -> str:
        return re.sub(r"[^a-z0-9]+", "", value.lower())

    for index, title in enumerate(titles):
        year = extract_year(title)
        href = ""
        link_kind = ""
        title_signature = signature(title)
        candidates = []
        for link in links:
            key = (link.get("url"), link.get("text"))
            if key in used:
                continue
            label_signature = signature(link.get("text") or "")
            if label_signature and title_signature[:24] == label_signature[:24]:
                candidates.append((len(label_signature), link, key))
        if candidates:
            _, matched, key = max(candidates, key=lambda item: item[0])
            href = matched["url"]
            link_kind = matched.get("kind") or ""
            used.add(key)
        correction = next(
            (filename for prefix, filename in known_file_corrections.items() if title_signature.startswith(prefix)),
            None,
        )
        if correction:
            href = f"https://www.benbroome.co.uk/s/{correction}"
            link_kind = "file"
        parts = [p.strip() for p in re.split(r"\s[:–-]\s", title) if p.strip()]
        publication = parts[0] if parts else ""
        headline = " — ".join(parts[1:]) if len(parts) > 1 else title
        slug = f"writing-{slugify(title)}"
        local_file = ""
        if href and (link_kind == "file" or href.lower().endswith(".pdf")):
            name = Path(unquote(urlparse(href).path)).name
            src = FILES / name
            if src.exists():
                PUBLIC_FILES.mkdir(parents=True, exist_ok=True)
                dest = PUBLIC_FILES / name
                if not dest.exists():
                    shutil.copy2(src, dest)
                local_file = f"/files/{name}"
        items.append({
            "slug": slug,
            "sourceSlug": "writing",
            "title": headline or title,
            "type": publication or "Writing",
            "publication": publication,
            "date": str(year) if year else "",
            "year": year,
            "description": title,
            "images": [],
            "files": [{"label": "Read", "href": local_file}] if local_file else [],
            "externalHref": None if local_file else (href or None),
            "featuredImage": "",
            "order": start_order + index,
            "category": "Selected Writing",
            "sourceUrl": href or page.get("url") or "",
        })
    return items


def press_items(page: dict, start_order: int) -> list[dict]:
    images = [img for img in page.get("images") or [] if not is_noise_image(img.get("filename") or "")]
    links = [
        link for link in page.get("links") or []
        if link.get("kind") == "external" and "instagram.com" not in (link.get("url") or "")
    ]
    items = []
    for index, img in enumerate(images):
        filename = unquote(img.get("filename") or f"press-{index}")
        title = Path(filename).stem.replace("+", " ")
        href = links[index]["url"] if index < len(links) else ""
        slug = f"press-{slugify(title)}"
        local = MIGRATION / (img.get("src") or "").lstrip("/").replace("/", os.sep)
        if not local.exists():
            grouped = GROUPED / "press"
            local = grouped / filename if grouped.exists() else local
        copied = copy_images(slug, [local] if local.exists() else [], title)
        items.append({
            "slug": slug,
            "sourceSlug": "press",
            "title": title,
            "type": "Press",
            "publication": title,
            "date": "",
            "year": 0,
            "description": "",
            "images": copied,
            "files": [],
            "externalHref": href or None,
            "featuredImage": copied[0]["src"] if copied else "",
            "order": start_order + index,
            "category": "Press",
            "sourceUrl": href or page.get("url") or "",
        })
    return items


def about_text(pages: dict[str, dict]) -> dict:
    home = pages.get("home") or {}
    blocks = home.get("blocks") or []
    text = blocks[0]["text"] if blocks else ""
    # Split the scraped homepage bio into the two existing paragraphs when possible.
    parts = re.split(r"(?<=etc\.)\s+", text, maxsplit=1)
    if len(parts) == 1:
        parts = re.split(r"(?<=etc\.)\s+", text.replace("etc.", "etc."), maxsplit=1)
    paragraphs = [p.strip() for p in parts if p.strip()]
    if len(paragraphs) == 1 and "With a human" in paragraphs[0]:
        lead, rest = paragraphs[0].split("With a human", 1)
        paragraphs = [lead.strip(), "With a human" + rest]
    return {
        "paragraphs": paragraphs or [
            "Ben Broome (b. 1994) is a London-based curator with a focus on artists working at the convergence of mediums: musical performance and performance art, film and video art.",
            "With a human-centric approach to curation and the resulting art viewership, Broome sets out to create a borderless nucleus for artists and viewer alike, creating space for cross-generational exchange and attempting to engage new audiences, often through varied programming.",
        ]
    }


def main() -> None:
    pages = page_by_slug()
    works: list[dict] = []
    used = set()

    def add(slug: str, category: str, listing: str | None = None):
        page = pages.get(slug)
        if not page or slug in used:
            return
        used.add(slug)
        works.append(work_from_page(page, category, len(works), listing))

    exhibition_page = pages.get("exhibition")
    exhibition_titles = [
        b["text"] for b in (exhibition_page.get("blocks") if exhibition_page else []) or []
        if b.get("class") == "portfolio-title"
    ]
    for slug, listing in zip(EXHIBITION_ORDER, exhibition_titles):
        add(slug, "Exhibition", listing)

    for slug in EXHIBITION_ORDER:
        add(slug, "Exhibition")

    performance_page = pages.get("performance")
    performance_titles = []
    seen_perf = set()
    for block in (performance_page.get("blocks") if performance_page else []) or []:
        text = (block.get("text") or "").strip()
        if text and text not in seen_perf:
            seen_perf.add(text)
            performance_titles.append(text)
    for slug, listing in zip(PERFORMANCE_ORDER, performance_titles):
        add(slug, "Performance", listing)
    for slug in PERFORMANCE_ORDER:
        add(slug, "Performance")

    for slug, page in pages.items():
        if slug in SKIP_PAGES or slug in used:
            continue
        if slug.startswith("exhibition__"):
            add(slug, "Exhibition")
        elif slug.startswith("artistgrant__"):
            continue
        else:
            add(slug, "Performance")

    for slug in GRANT_ORDER:
        add(slug, "Artist Grant")

    if "writing" in pages:
        works.extend(writing_items(pages["writing"], len(works)))
    if "press" in pages:
        works.extend(press_items(pages["press"], len(works)))

    if PUBLIC_WORK.exists():
        for child in PUBLIC_WORK.iterdir():
            if child.is_dir() and child.name not in {w["sourceSlug"] for w in works} and not child.name.startswith("press-") and not child.name.startswith("writing-"):
                # Keep only folders we just wrote; press/writing slugs are new dirs.
                pass

    payload = {
        "about": about_text(pages),
        "works": works,
    }
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(works)} works to {OUT_JSON}")
    print(f"Images copied into {PUBLIC_WORK}")


if __name__ == "__main__":
    main()

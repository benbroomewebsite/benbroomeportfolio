#!/usr/bin/env python3
"""Build one deduplicated, upload-ready R2 media directory."""

from __future__ import annotations

import csv
import hashlib
import json
import shutil
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "benbroome-squarespace-migration"
STAGING = ROOT / "r2-staging"


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def safe_name(name: str, fallback: str) -> str:
    cleaned = Path(unquote(name)).name.strip().replace("\\", "-")
    return cleaned or fallback


def main() -> None:
    # Keep new project originals and web derivatives when refreshing the legacy
    # Squarespace staging folders.
    for directory in (STAGING / "images", STAGING / "files"):
        if directory.exists():
            shutil.rmtree(directory)
    image_dir = STAGING / "images"
    file_dir = STAGING / "files"
    image_dir.mkdir(parents=True)
    file_dir.mkdir(parents=True)

    site = json.loads((MIGRATION / "site.json").read_text(encoding="utf-8"))
    records = []
    by_hash: dict[str, str] = {}
    claimed: dict[str, str] = {}

    def stage(source: Path, desired_name: str, kind: str, source_url: str) -> None:
        sha = digest(source)
        folder = image_dir if kind == "image" else file_dir
        prefix = "images" if kind == "image" else "files"
        name = safe_name(desired_name, f"{sha[:12]}{source.suffix.lower()}")
        # Images are content-deduplicated. Downloadable files retain each public
        # Squarespace basename so existing document URLs can be recreated in R2.
        hash_key = f"{kind}:{sha}" if kind == "image" else f"{kind}:{name.lower()}"
        if hash_key in by_hash:
            key = by_hash[hash_key]
        else:
            candidate = name
            if candidate.lower() in claimed and claimed[candidate.lower()] != sha:
                stem, suffix = Path(candidate).stem, Path(candidate).suffix
                candidate = f"{stem}__{sha[:8]}{suffix}"
            shutil.copy2(source, folder / candidate)
            key = f"{prefix}/{candidate}"
            claimed[candidate.lower()] = sha
            by_hash[hash_key] = key
        records.append({
            "kind": kind,
            "source_url": source_url,
            "original_filename": name,
            "object_key": key,
            "sha256": sha,
            "bytes": source.stat().st_size,
        })

    for item in site.get("images", []):
        source = Path(item.get("local_path") or "")
        if source.is_file():
            name = item.get("filename") or Path(urlparse(item.get("url") or "").path).name
            stage(source, name, "image", item.get("url") or "")

    for item in site.get("files", []):
        source = Path(item.get("local_path") or "")
        if source.is_file():
            # PDFs and downloads retain their original Squarespace basename.
            name = Path(unquote(urlparse(item.get("url") or "").path)).name or item.get("filename")
            stage(source, name, "file", item.get("url") or "")

    manifest = {
        "version": 1,
        "source": "https://www.benbroome.co.uk/",
        "object_count": len(by_hash),
        "reference_count": len(records),
        "objects": records,
    }
    (STAGING / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    with (STAGING / "manifest.csv").open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=records[0].keys())
        writer.writeheader()
        writer.writerows(records)

    # Map every URL currently used by the app to its deduplicated R2 key. This
    # lets production switch to R2 with one environment variable while keeping
    # local files as a development fallback.
    map_path = ROOT / "lib" / "media-map.json"
    media_map: dict[str, str] = json.loads(map_path.read_text(encoding="utf-8")) if map_path.exists() else {}
    works = json.loads((ROOT / "lib" / "works.json").read_text(encoding="utf-8"))
    app_paths = {
        image["src"]
        for work in works.get("works", [])
        for image in work.get("images", [])
        if image.get("src")
    }
    app_paths.update(
        f"/carousel-hires/{path.name}" for path in (ROOT / "public" / "carousel-hires").glob("*") if path.is_file()
    )
    for public_path in sorted(app_paths):
        source = ROOT / "public" / public_path.lstrip("/")
        if source.is_file():
            key = by_hash.get(f"image:{digest(source)}")
            if key:
                media_map[public_path] = key
    for path in file_dir.glob("*"):
        media_map[f"/files/{path.name}"] = f"files/{path.name}"
    (ROOT / "lib" / "media-map.json").write_text(
        json.dumps(media_map, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(f"Staged {len(by_hash)} unique objects from {len(records)} source references")


if __name__ == "__main__":
    main()

"""Record pixel dimensions for project images that the import left unsized.

Reads each image from r2-bucket/ (falling back to the public R2 bucket) and
writes lib/image-sizes.json, keyed by the image's site path. The project page
uses these to lay out gallery rows without layout shift.
"""
import io
import json
from pathlib import Path
from urllib.parse import quote

import requests
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MEDIA_BASE = "https://pub-77bd6b0eb2e9483f9b0201fc3bb527e7.r2.dev"

works = json.loads((ROOT / "lib/works.json").read_text(encoding="utf-8"))["works"]
media = json.loads((ROOT / "lib/media-map.json").read_text(encoding="utf-8"))
out_path = ROOT / "lib/image-sizes.json"
sizes = json.loads(out_path.read_text(encoding="utf-8")) if out_path.exists() else {}
missing = []


def displayed_size(opened):
    # Browsers apply EXIF rotation, so a sideways-stored photo swaps its sides.
    width, height = opened.size
    return [height, width] if opened.getexif().get(0x0112) in (5, 6, 7, 8) else [width, height]


for work in works:
    for image in work["images"]:
        src = image["src"]
        if image.get("width") or src in sizes or src.lower().endswith(".pdf"):
            continue
        key = media.get(src)
        if not key:
            missing.append(src)
            continue
        local = ROOT / "r2-bucket" / key
        try:
            if local.exists():
                with Image.open(local) as opened:
                    sizes[src] = displayed_size(opened)
            else:
                response = requests.get(f"{MEDIA_BASE}/{quote(key)}", timeout=60)
                response.raise_for_status()
                with Image.open(io.BytesIO(response.content)) as opened:
                    sizes[src] = displayed_size(opened)
        except Exception as error:  # keep going; unsized images fall back to 4:3
            missing.append(f"{src} ({error})")

lines = ",\n".join(f"  {json.dumps(src)}: {json.dumps(size)}" for src, size in sorted(sizes.items()))
out_path.write_text("{\n" + lines + "\n}\n", encoding="utf-8")
print(json.dumps({"sized": len(sizes), "missing": missing}, indent=2))

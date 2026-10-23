"""Render the first page of each project's PDF as its index hover preview.

Applies to projects whose preview would otherwise be empty: those with a PDF
and no image of their own. Images are written to public/previews/.
"""
import json
from pathlib import Path
from urllib.parse import quote

import fitz  # PyMuPDF
import requests

ROOT = Path(__file__).resolve().parent.parent
MEDIA_BASE = "https://pub-77bd6b0eb2e9483f9b0201fc3bb527e7.r2.dev"
media = json.loads((ROOT / "lib/media-map.json").read_text(encoding="utf-8"))
out = ROOT / "public" / "previews"
out.mkdir(parents=True, exist_ok=True)

for path in sorted((ROOT / "content/works").glob("*.json")):
    work = json.loads(path.read_text(encoding="utf-8"))
    pdf = next((file["href"] for file in work["files"] if file["href"].lower().endswith(".pdf")), None)
    if not pdf or work["images"] or pdf not in media:
        continue
    local = ROOT / "r2-bucket" / media[pdf]
    data = local.read_bytes() if local.exists() else requests.get(f"{MEDIA_BASE}/{quote(media[pdf])}", timeout=120).content
    page = fitz.open(stream=data, filetype="pdf")[0]
    pixmap = page.get_pixmap(matrix=fitz.Matrix(1200 / page.rect.width, 1200 / page.rect.width), alpha=False)
    pixmap.pil_save(out / f"{path.stem}.jpg", quality=84)
    work["featuredImage"] = f"/previews/{path.stem}.jpg"
    path.write_text(json.dumps(work, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{path.stem}: {pixmap.width}x{pixmap.height}")

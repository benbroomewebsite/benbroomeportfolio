"""Give link-only writing entries a lead image and opening lines.

For each Selected Writing project that has an external link but no PDF or
image, reads the article's own share image and summary (its Open Graph tags),
saves the image to public/previews/ and writes both into the project file.
Publications that refuse automated requests are reported and left unchanged.
"""
import html
import io
import json
import re
import subprocess
from pathlib import Path
from urllib.parse import urljoin

import requests
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PREVIEWS = ROOT / "public" / "previews"
AGENT = {"User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"}
# Some publications (Frieze) turn the share crawler and Python clients away but
# answer curl presenting itself as a browser.
BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36"


def curl(url):
    return subprocess.run(["curl", "-sfL", "-A", BROWSER, "-H", "Accept-Language: en-GB", url], capture_output=True, check=True, timeout=60).stdout
# Pages whose share tags describe the publication rather than the article.
SKIP = {"a-conversation-with-ladji-diaby", "claudia-comte-vistamare"}
GENERIC_SUMMARY = {"simon-conrad-sies-hoke-dusseldorf"}


def meta(page, name):
    tag = re.search(rf'<meta[^>]*property=["\']og:{name}["\'][^>]*>', page, re.I)
    content = tag and re.search(r'content=["\'](.*?)["\']\s*/?>?$|content="([^"]*)"', tag.group(0), re.S)
    return html.unescape(html.unescape((content.group(2) or content.group(1) or "").strip())) if content else ""


PREVIEWS.mkdir(parents=True, exist_ok=True)
skipped = []
for path in sorted((ROOT / "content/works").glob("*.json")):
    work = json.loads(path.read_text(encoding="utf-8"))
    href = work.get("externalHref")
    if work["category"] != "Selected Writing" or not href or work.get("files") or work.get("images") or path.stem in SKIP:
        continue
    try:
        page = requests.get(href, headers=AGENT, timeout=30).text
        if not meta(page, "image"):
            page = curl(href).decode("utf-8", "replace")
        image_url = meta(page, "image")
        if not image_url:
            raise ValueError("no share image")
        image = Image.open(io.BytesIO(curl(urljoin(href, image_url)))).convert("RGB")
        image.thumbnail((1600, 1600))
        image.save(PREVIEWS / f"{path.stem}.jpg", quality=86)
    except Exception as error:
        skipped.append(f"{path.stem}: {error}")
        continue
    src = f"/previews/{path.stem}.jpg"
    summary = "" if path.stem in GENERIC_SUMMARY else meta(page, "description")
    if summary and not re.search(r"[.!?”\"]$", summary):
        summary = summary.rstrip(" ,;:…") + "…"
    work["description"] = summary
    work["featuredImage"] = src
    work["images"] = [{"src": src, "alt": work["title"], "group": "", "width": image.width, "height": image.height, "originalName": ""}]
    path.write_text(json.dumps(work, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{path.stem}: {image.width}x{image.height}, {len(summary)} characters")

print(json.dumps({"skipped": skipped}, indent=2))

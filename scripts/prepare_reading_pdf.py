"""Prepare a smaller Arcane reading PDF without changing the source download."""
import hashlib
import json
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[1]

def digest(path):
    with path.open('rb') as handle:
        return hashlib.file_digest(handle, 'sha256').hexdigest()

def main():
    work = next(item for item in json.loads((ROOT / 'lib/works.json').read_text(encoding='utf8'))['works'] if item['slug'] == 'arcane-magazine-intervention')
    source_href = work['files'][0]['href']
    mapping = json.loads((ROOT / 'lib/media-map.json').read_text(encoding='utf8'))
    source = ROOT / 'r2-staging' / mapping[source_href]
    source_hash = digest(source)
    key = f'documents/reading/{source_hash[:16]}-v1.pdf'
    output = ROOT / 'r2-staging' / key
    output.parent.mkdir(parents=True, exist_ok=True)
    with fitz.open(source) as document:
        page_count = len(document)
        original_text = [page.get_text() for page in document]
        if not output.exists():
            document.rewrite_images(dpi_threshold=180, dpi_target=144, quality=85)
            document.save(output, garbage=4, deflate=True, no_new_id=True)
    with fitz.open(output) as document:
        assert len(document) == page_count
        assert [page.get_text() for page in document] == original_text
        # Render every page for visual QA.
        for index in range(page_count):
            document[index].get_pixmap(matrix=fitz.Matrix(.8, .8), alpha=False).save(ROOT / 'r2-staging' / f'arcane-reading-page-{index+1}.png')
    (ROOT / 'lib/pdf-reading-map.json').write_text(json.dumps({source_href: key}, indent=2)+'\n', encoding='utf8')
    manifest = {'objects': [{'object_key': key, 'sha256': digest(output), 'bytes': output.stat().st_size, 'kind': 'reading-pdf'}], 'source_sha256': source_hash, 'source_href': source_href, 'pages': page_count}
    (ROOT / 'lib/pdf-reading-manifest.json').write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf8')
    assert digest(source) == source_hash
    print(f'Reading PDF: {source.stat().st_size/1e6:.1f} MB -> {output.stat().st_size/1e6:.1f} MB; {page_count} pages; original unchanged')

if __name__ == '__main__':
    main()

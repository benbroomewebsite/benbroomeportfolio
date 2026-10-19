"""Import the dropped project folders without moving or modifying originals.

Run from the repository root. Requires Pillow, PyMuPDF and ffmpeg.
The manifest records every source file and every upload with a SHA-256 digest.
"""
import hashlib
import json
import re
import shutil
import subprocess
from pathlib import Path

import fitz
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
STAGING = ROOT / 'r2-staging'
CONFIG = [
    ('Arcane Magazine', 'arcane-magazine-intervention', 'Arcane Magazine Intervention', 'Selected Writing', 'Intervention', 'Arcane Magazine', '2025-01', ''),
    ('Exhibition - Nihaal', 'nihaal-faizal-cave', 'Nihaal Faizal', 'Exhibition', 'Exhibition', 'Cave, New York', '2026-03', ''),
    ('Exhibition - Zazou', 'zazou-roddam-essais', 'Zazou Roddam', 'Exhibition', 'Exhibition', 'Essais, Paris', '2026-05', ''),
    ('Olukemi Lijadu', 'olukemi-lijadu-pamela-dayes-slg', 'Olukemi Lijadu & Pamela Dayes', 'Talk', 'Talk', 'South London Gallery, London', '2026-06-24', 'A conversation about their collaboration for Rooms of Neighbours, bringing family photographs into dialogue across shared Caribbean histories.'),
    ('Performance - DYNAMITE', 'dynamite-bridgehouse', 'Dynamite', 'Performance', 'Performance', 'Bridgehouse, Meadows', '2026-08', ''),
    ('Performance - POWERPLANT', 'powerplant-bridgehouse', 'Powerplant', 'Performance', 'Performance', 'Bridgehouse, Meadows', '2026-08', ''),
    ('Performance - RAHEEL', 'raheel-khan-french-ordinary-court', 'Raheel Khan', 'Performance', 'Performance', 'French Ordinary Court, London', '2026-07', ''),
    ('Performance - TRASHTALK', 'trashtalk-bridgehouse', 'Trash Talk', 'Performance', 'Performance', 'Bridgehouse, Meadows', '2026-08', ''),
    ('Performance - YHWH', 'yhwh-nailgun-marble-arch-pit', 'YHWH Nailgun', 'Performance', 'Performance', 'Marble Arch Pit, London', '2026-06', ''),
    ('Project - Rooms', 'rooms-of-neighbours', 'Rooms of Neighbours', 'Exhibition', 'Exhibition', 'Clifton Crescent, London', '2025', 'An ongoing exhibition curated by Ben Broome across twelve households on Clifton Crescent, Peckham. Each participating household was paired with an artist, who collaborated with residents to install work in their home or a communal space.\n\nTaking Jan Hoet’s Chambres d’amis (1986) as a point of departure, the project explores the domestic exhibition as a social process. Supported by Arts Council England. The exhibition began in 2025; this documentation is from April 2026.'),
    ('Talk - Ben Kinmont', 'ben-kinmont-goldsmiths-cca', 'Ben Kinmont', 'Talk', 'Talk', 'Goldsmiths CCA, London', '2026-06-01', ''),
    ('Talk - Isabella', 'isabella-costabile-gasworks', 'Isabella Costabile', 'Talk', 'Talk', 'Gasworks, London', '2026-04-30', ''),
    ('Talk - Josiane', 'josiane-pozi-yvette-francis-slg', 'Josiane M. H. Pozi & Yvette Francis', 'Talk', 'Talk', 'South London Gallery, London', '2026-05-20', 'A conversation about their collaboration for Rooms of Neighbours: drawings charting conversations, visits and messages between people they love.'),
]

def natural(path):
    return tuple((0, int(part)) if part.isdigit() else (1, part.lower()) for part in re.split(r'(\d+)', str(Path(path).with_suffix(''))))

def sha(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()

def slugify(value):
    return re.sub(r'[^a-z0-9]+', '-', value.lower()).strip('-')

def main():
    data = json.loads((ROOT / 'lib/works.json').read_text(encoding='utf8'))
    import_slugs = {config[1] for config in CONFIG}
    base_count = sum(work['slug'] not in import_slugs for work in data['works'])
    media_map = json.loads((ROOT / 'lib/media-map.json').read_text(encoding='utf8'))
    records, objects = [], {}

    def record(path, key, kind):
        objects[key] = {'object_key': key, 'sha256': sha(path), 'bytes': path.stat().st_size, 'kind': kind}

    def stage_original(source, slug):
        digest = sha(source)
        name = slugify(source.stem) + source.suffix.lower()
        key = f'originals/{slug}/{digest[:16]}-{name}'
        dest = STAGING / key
        dest.parent.mkdir(parents=True, exist_ok=True)
        if not dest.exists():
            shutil.copy2(source, dest)
        record(dest, key, 'original')
        records.append({'source': source.relative_to(ROOT).as_posix(), 'object_key': key, 'sha256': digest, 'bytes': source.stat().st_size})
        return digest, key

    def stage_image(source, slug, index, title, group=None, pdf=False):
        digest = sha(source)
        key = f'work/{slug}/{index:03d}-{digest[:12]}.webp'
        dest = STAGING / key
        dest.parent.mkdir(parents=True, exist_ok=True)
        if not dest.exists():
            if pdf:
                with fitz.open(source) as doc:
                    pix = doc[0].get_pixmap(matrix=fitz.Matrix(1.8, 1.8), alpha=False)
                    image = Image.frombytes('RGB', [pix.width, pix.height], pix.samples)
            else:
                with Image.open(source) as img:
                    image = ImageOps.exif_transpose(img).convert('RGB')
            image.thumbnail((2400, 2400))
            image.save(dest, 'WEBP', quality=88, method=6)
        with Image.open(dest) as image:
            width, height = image.size
        record(dest, key, 'image')
        public = ROOT / 'public' / key
        public.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(dest, public)
        media_map['/' + key] = key
        return {'src': '/' + key, 'alt': f'{title} — {group}' if group else title, 'originalName': source.name, 'width': width, 'height': height, **({'group': group} if group else {})}

    imported = []
    for prefix, slug, title, category, kind, venue, date, description in CONFIG:
        candidates = list(ROOT.iterdir()) + (list((ROOT / 'source-media').iterdir()) if (ROOT / 'source-media').exists() else [])
        matches = [p for p in candidates if p.is_dir() and p.name.startswith(prefix)]
        if len(matches) != 1:
            raise ValueError(f'Expected one source folder for {prefix}: {matches}')
        folder = matches[0]
        media_map = {public: key for public, key in media_map.items() if not public.startswith((f'/work/{slug}/', f'/originals/{slug}/'))}
        sources = sorted([p for p in folder.rglob('*') if p.is_file()], key=lambda p: natural(p.relative_to(folder)))
        if slug == 'arcane-magazine-intervention':
            sources.sort(key=lambda p: (0 if p.stem.lower().startswith('intro') else 1, natural(p.name)))
        elif slug == 'zazou-roddam-essais':
            sources.sort(key=lambda p: (0 if p.name.startswith('GEP') else 1, natural(p.name)))
        elif slug == 'raheel-khan-french-ordinary-court':
            sources.sort(key=lambda p: (0 if 'PHOTOGRAPHY' in p.parts else 1, natural(p.relative_to(folder))))
        elif slug == 'yhwh-nailgun-marble-arch-pit':
            sources.sort(key=lambda p: (0 if p.name.startswith('IZZY') else 1, natural(p.name)))
        images, videos, files, seen = [], [], [], set()
        for source in sources:
            ext = source.suffix.lower()
            if ext not in {'.jpg', '.jpeg', '.png', '.webp', '.pdf', '.mov', '.mp4'}:
                raise ValueError(f'Unsupported source: {source}')
            digest, original_key = stage_original(source, slug)
            if digest in seen:
                continue
            seen.add(digest)
            group = None
            if slug == 'rooms-of-neighbours' and source.parent != folder:
                group = source.parent.name.replace('-Clifton-Crescent', '').replace('-', ' ')
                group = group.replace('Josiane M.H Pozi', 'Josiane M. H. Pozi')
            if ext in {'.jpg', '.jpeg', '.png', '.webp'}:
                images.append(stage_image(source, slug, len(images)+1, title, group))
            elif ext == '.pdf':
                public = '/' + original_key
                media_map[public] = original_key
                files.append({'label': 'Press release' if slug == 'rooms-of-neighbours' else 'Publication' if slug == 'arcane-magazine-intervention' else 'Event details', 'href': public})
            else:
                key = f'work/{slug}/video-{len(videos)+1:02d}-{digest[:12]}.mp4'
                dest = STAGING / key
                dest.parent.mkdir(parents=True, exist_ok=True)
                if not dest.exists():
                    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(source), '-map', '0:v:0', '-map', '0:a?', '-vf', 'scale=min(1920\\,iw):-2', '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart', str(dest)], check=True)
                record(dest, key, 'video')
                media_map['/' + key] = key
                videos.append({'src': '/' + key, 'label': f'{title} — video {len(videos)+1}', **({'group': group} if group else {})})
        if not images and files:
            pdf_source = next(p for p in sources if p.suffix.lower() == '.pdf')
            images.append(stage_image(pdf_source, slug, 1, title, pdf=True))
        work = {'slug': slug, 'title': title, 'type': kind, 'publication': venue, 'date': date, 'sortDate': date, 'year': int(date[:4]), 'description': description, 'images': images, 'videos': videos, 'files': files, 'externalHref': None, 'featuredImage': images[0]['src'] if images else '', 'order': base_count + len(imported), 'category': category}
        if slug == 'arcane-magazine-intervention':
            work['preserveTitle'] = True
        imported.append(work)
        print(f'{title}: {len(images)} images, {len(videos)} videos, {len(files)} PDFs', flush=True)
    slugs = {w['slug'] for w in imported}
    data['works'] = [w for w in data['works'] if w['slug'] not in slugs] + imported
    (ROOT / 'lib/works.json').write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
    (ROOT / 'lib/media-map.json').write_text(json.dumps(media_map, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
    manifest = {'version': 1, 'projects': sorted(slugs), 'sources': records, 'objects': list(objects.values())}
    (STAGING / 'new-media-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
    (ROOT / 'lib/new-media-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
    print(f'Imported {len(imported)} projects, {len(records)} source files, {len(objects)} objects')

if __name__ == '__main__':
    main()

"""Apply the October naming corrections and register the supplied SLG photograph."""
import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]

def read(path):
    return json.loads(path.read_text(encoding='utf8'))

def write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf8')

changed = []
for path in (ROOT / 'content/works').glob('*.json'):
    work = read(path)
    original = json.dumps(work)
    if work.get('publication') == 'Gladstone':
        work['publication'] = 'Gladstone Gallery'
    elif work.get('publication', '').startswith('Gladstone,'):
        work['publication'] = work['publication'].replace('Gladstone,', 'Gladstone Gallery,', 1)
    if work.get('category') == 'Artist Grant':
        work['publication'] = 'artistgrant.co.uk'
        year = work['date'][:4]
        page = {'2024': '2024grant-ntd96', '2023': '2023grant', '2022': '2022grant-8clt8', '2021': '2021grant-sbbp8'}[year]
        href = f'https://www.artistgrant.co.uk/previouswinners/{page}'
        work['links'] = [link for link in work['links'] if link['label'] != 'artistgrant.co.uk']
        work['links'].append({'label': 'artistgrant.co.uk', 'href': href})
    if json.dumps(work) != original:
        write(path, work)
        changed.append(path.stem)

source = ROOT / 'Olukemi-Lijadu-Clifton-Crescent-4-2048x1365.jpg'
sha = hashlib.sha256(source.read_bytes()).hexdigest()
slug = 'olukemi-lijadu-pamela-dayes-slg'
original_key = f'originals/{slug}/{sha[:16]}-{source.name.lower()}'
image_key = f'work/{slug}/olukemi-lijadu-clifton-crescent-4-{sha[:12]}.webp'
staging = ROOT / 'r2-staging'
for key in (original_key, image_key):
    (staging / key).parent.mkdir(parents=True, exist_ok=True)
shutil.copy2(source, staging / original_key)
with Image.open(source) as image:
    width, height = image.size
    image.convert('RGB').save(staging / image_key, 'WEBP', quality=90, method=6)

path = ROOT / f'content/works/{slug}.json'
work = read(path)
work['featuredImage'] = '/' + image_key
work['images'] = [{'src': '/' + image_key, 'alt': 'Olukemi Lijadu’s framed photographic work above a sideboard in Pamela Dayes’s home on Clifton Crescent. Photograph: Jorge Stride.', 'group': '', 'width': width, 'height': height, 'originalName': source.name}]
write(path, work)
path = ROOT / 'lib/media-map.json'
mapping = read(path)
mapping['/' + image_key] = image_key
mapping['/' + original_key] = original_key
write(path, mapping)
path = ROOT / 'lib/new-media-manifest.json'
manifest = read(path)
for key, kind in ((original_key, 'original'), (image_key, 'image')):
    local = staging / key
    item = {'object_key': key, 'sha256': hashlib.sha256(local.read_bytes()).hexdigest(), 'bytes': local.stat().st_size, 'kind': kind}
    manifest['objects'] = [obj for obj in manifest['objects'] if obj['object_key'] != key] + [item]
write(path, manifest)
print('Updated names:', ', '.join(changed))
print('Registered supplied photograph:', image_key, width, height)

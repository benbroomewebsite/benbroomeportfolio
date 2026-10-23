"""Read-only R2 download into r2-bucket/; inventory and hashes live outside it.

Uses the existing Wrangler login (refresh with `wrangler whoami` first).
Never uploads, deletes, or changes a remote object. Reruns reuse verified bytes.
"""
import argparse
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import threading
import time
import tomllib
from urllib.parse import quote

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

ROOT = Path(__file__).resolve().parents[1]
MIRROR = ROOT / 'r2-bucket'
REPORTS = ROOT / 'docs' / 'r2-mirror'
ACCOUNT = os.environ.get('CLOUDFLARE_ACCOUNT_ID', '6e0c36e454fa6e50d978601733ec8932')
BUCKET = os.environ.get('R2_BUCKET', 'benbroome-portfolio-media')
API = f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/r2/buckets/{BUCKET}/objects'


def digest(path, kind):
    with path.open('rb') as handle:
        return hashlib.file_digest(handle, kind).hexdigest()


def safe_target(key):
    parts = PurePosixPath(key).parts
    if not parts or key.startswith('/') or any(part in ('.', '..') or re.search(r'[<>:"\\|?*\x00-\x1f]', part) or part.endswith((' ', '.')) or re.match(r'^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)', part, re.I) for part in parts):
        raise ValueError(f'Object key cannot be represented exactly on Windows: {key}')
    target = MIRROR.joinpath(*parts)
    if not target.resolve().is_relative_to(MIRROR.resolve()):
        raise ValueError('Object key escapes mirror')
    return target


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify-only', action='store_true')
    args = parser.parse_args()
    config = Path(os.environ['APPDATA']) / 'xdg.config/.wrangler/config/default.toml'
    token = os.environ.get('CLOUDFLARE_API_TOKEN') or tomllib.loads(config.read_text())['oauth_token']
    local = threading.local()

    def session():
        if not hasattr(local, 'session'):
            value = requests.Session()
            value.headers.update({'Authorization': 'Bearer ' + token, 'Accept-Encoding': 'identity'})
            value.mount('https://', HTTPAdapter(max_retries=Retry(total=4, backoff_factor=1, status_forcelist=[429, 500, 502, 503, 504])))
            local.session = value
        return local.session

    def inventory():
        objects, cursor, seen = [], None, set()
        while True:
            params = {'per_page': 1000, 'limit': 1000}
            if cursor:
                params['cursor'] = cursor
            response = session().get(API, params=params, timeout=60)
            response.raise_for_status()
            data = response.json()
            if not data.get('success'):
                raise RuntimeError('R2 inventory failed')
            objects.extend(data['result'])
            info = data.get('result_info', {})
            if not info.get('is_truncated'):
                break
            cursor = info.get('cursor')
            if not cursor or cursor in seen:
                raise RuntimeError('R2 pagination did not advance')
            seen.add(cursor)
        return sorted(objects, key=lambda item: item['key'])

    objects = inventory()
    print(f'Live bucket: {len(objects)} objects, {sum(o["size"] for o in objects):,} bytes', flush=True)
    targets = [safe_target(o['key']) for o in objects]
    if len({str(p).casefold() for p in targets}) != len(targets):
        raise RuntimeError('Remote keys collide on a case-insensitive Windows disk')
    REPORTS.mkdir(parents=True, exist_ok=True)
    (REPORTS / 'inventory.json').write_text(json.dumps({'account': ACCOUNT, 'bucket': BUCKET, 'objects': objects}, indent=2) + '\n', encoding='utf-8')
    reverse = {v: k for k, v in json.loads((ROOT / 'lib/media-map.json').read_text(encoding='utf-8')).items()}
    MIRROR.mkdir(exist_ok=True)

    def matches(path, obj):
        return path.is_file() and path.stat().st_size == obj['size'] and '-' not in obj['etag'] and digest(path, 'md5') == obj['etag'].strip('"')

    def mirror(obj):
        key = obj['key']
        target = safe_target(key)
        action = 'reused'
        if not matches(target, obj):
            if args.verify_only:
                raise ValueError(f'Missing or mismatched mirror file: {key}')
            sources = [ROOT / 'r2-staging' / key]
            if key in reverse:
                sources.append(ROOT / 'public' / reverse[key].lstrip('/'))
            source = next((path for path in sources if matches(path, obj)), None)
            target.parent.mkdir(parents=True, exist_ok=True)
            temporary = target.with_name(target.name + '.r2-download-part')
            if source:
                shutil.copyfile(source, temporary)
                action = 'copied'
            else:
                response = session().get(API + '/' + quote(key, safe='/'), stream=True, timeout=(30, 300))
                response.raise_for_status()
                if response.headers.get('ETag', '').strip('"') != obj['etag'].strip('"'):
                    raise ValueError(f'Remote object changed during download: {key}')
                with response, temporary.open('wb') as handle:
                    for chunk in response.iter_content(1024 * 1024):
                        handle.write(chunk)
                action = 'downloaded'
            if temporary.stat().st_size != obj['size'] or ('-' not in obj['etag'] and not matches(temporary, obj)):
                raise ValueError(f'Content verification failed: {key}')
            temporary.replace(target)
        return {'key': key, 'bytes': target.stat().st_size, 'etag': obj['etag'], 'sha256': digest(target, 'sha256'), 'action': action}

    results, failures = [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        jobs = {pool.submit(mirror, obj): obj['key'] for obj in objects}
        for completed, job in enumerate(concurrent.futures.as_completed(jobs), 1):
            try:
                results.append(job.result())
            except Exception as error:
                failures.append({'key': jobs[job], 'error': type(error).__name__})
                print('FAILED', jobs[job], type(error).__name__, flush=True)
            if completed % 100 == 0 or completed == len(objects):
                print(f'Verified {completed}/{len(objects)}; failures {len(failures)}', flush=True)
    if failures:
        (REPORTS / 'failures.json').write_text(json.dumps(failures, indent=2), encoding='utf-8')
        raise RuntimeError('Mirror incomplete; local cleanup is not permitted')
    # Refuse cleanup if anything changed in the bucket during the run.
    if inventory() != objects:
        raise RuntimeError('Remote inventory changed; rerun before local cleanup')
    expected = {obj['key'] for obj in objects}
    extras = [p for p in MIRROR.rglob('*') if p.is_file() and p.relative_to(MIRROR).as_posix() not in expected]
    if args.verify_only and extras:
        raise RuntimeError('Extra files in mirror')
    for path in extras:
        if not path.resolve().is_relative_to(MIRROR.resolve()):
            raise ValueError('Cleanup target escapes mirror')
        path.unlink()
    for path in sorted(MIRROR.rglob('*'), key=lambda p: len(p.parts), reverse=True):
        if path.is_dir() and not any(path.iterdir()):
            path.rmdir()
    report = {'bucket': BUCKET, 'verified_at_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'object_count': len(objects), 'total_bytes': sum(o['size'] for o in objects), 'extra_files_removed': len(extras), 'objects': sorted(results, key=lambda item: item['key'])}
    (REPORTS / 'verification.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(f'EXACT MIRROR VERIFIED: {len(objects)} paths, sizes and contents; remote unchanged.', flush=True)


if __name__ == '__main__':
    main()

"""Upload missing/mismatched portfolio media and verify public R2 objects.

Uses the existing Wrangler OAuth login (run `wrangler whoami` first to refresh).
Checks byte length, Content-Type and the R2 single-part MD5 ETag; falls back
to downloading and hashing when an object has a multipart ETag.
No objects are deleted. Reruns skip verified objects. --verify-only never writes.
"""
import argparse
import concurrent.futures
import hashlib
import json
import mimetypes
import os
from pathlib import Path
import threading
import time
import tomllib
from urllib.parse import quote

import requests

ROOT = Path(__file__).resolve().parents[1]
STAGING = ROOT / 'r2-staging'
BASE = os.environ.get('NEXT_PUBLIC_MEDIA_BASE_URL', 'https://pub-77bd6b0eb2e9483f9b0201fc3bb527e7.r2.dev').rstrip('/')
BUCKET = os.environ.get('R2_BUCKET', 'benbroome-portfolio-media')
ACCOUNT = os.environ.get('CLOUDFLARE_ACCOUNT_ID', '6e0c36e454fa6e50d978601733ec8932')
TYPES = {'.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.mov': 'video/quicktime'}

def digest(path, algorithm):
    with path.open('rb') as handle:
        return hashlib.file_digest(handle, algorithm).hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify-only', action='store_true')
    parser.add_argument('--new-only', action='store_true')
    parser.add_argument('--staged-new', action='store_true', help='Sync completed new staging files while the importer is still running')
    parser.add_argument('--retry-failures', action='store_true', help='Retry only failed objects and retain prior verification results')
    parser.add_argument('--reading-only', action='store_true', help='Sync optimized reading PDFs only')
    parser.add_argument('--workers', type=int, default=4)
    parser.add_argument('--requests-per-second', type=float, default=2)
    args = parser.parse_args()
    if args.staged_new:
        paths = [path for directory in (STAGING / 'work', STAGING / 'originals') for path in directory.rglob('*') if path.is_file() and time.time() - path.stat().st_mtime > 30]
        new = {'objects': [{'object_key': path.relative_to(STAGING).as_posix(), 'sha256': digest(path, 'sha256')} for path in paths]}
    else:
        new = json.loads((ROOT / 'lib/new-media-manifest.json').read_text(encoding='utf8'))
        reading_manifest = ROOT / 'lib/pdf-reading-manifest.json'
        reading = json.loads(reading_manifest.read_text(encoding='utf8')) if reading_manifest.exists() else {'objects': []}
        new['objects'] = reading['objects'] if args.reading_only else new['objects'] + reading['objects']
    objects = {item['object_key']: STAGING / item['object_key'] for item in new['objects']}
    expected_sha = {item['object_key']: item['sha256'] for item in new['objects']}
    if not args.new_only and not args.staged_new and not args.reading_only:
        mapping = json.loads((ROOT / 'lib/media-map.json').read_text(encoding='utf8'))
        for public, key in mapping.items():
            objects.setdefault(key, STAGING / key if (STAGING / key).is_file() else ROOT / 'public' / public.lstrip('/'))
    token = os.environ.get('CLOUDFLARE_API_TOKEN')
    if not args.verify_only and not token:
        config = Path(os.environ['APPDATA']) / 'xdg.config/.wrangler/config/default.toml'
        token = tomllib.loads(config.read_text(encoding='utf8'))['oauth_token']
    local = threading.local()
    completed, results = 0, []
    report_path = STAGING / ('reading-verification-report.json' if args.reading_only else 'verification-report.json')
    if args.retry_failures:
        previous = json.loads(report_path.read_text(encoding='utf8'))
        if previous['bucket'] != BUCKET or previous['public_base_url'] != BASE:
            raise ValueError('Previous report belongs to a different bucket')
        failed_keys = {item['object_key'] for item in previous['failures']}
        results = previous['objects']
        objects = {key: path for key, path in objects.items() if key in failed_keys}
    rate_lock = threading.Lock()
    next_request = 0.0

    def throttle():
        nonlocal next_request
        with rate_lock:
            delay = max(0, next_request - time.monotonic())
            next_request = max(next_request, time.monotonic()) + 1 / args.requests_per_second
        if delay:
            time.sleep(delay)

    def worker(item):
        key, path = item
        if not path.is_file():
            raise FileNotFoundError(f'No local file for {key}')
        if key in expected_sha and digest(path, 'sha256') != expected_sha[key]:
            raise ValueError(f'Staged file changed: {key}')
        size, md5 = path.stat().st_size, digest(path, 'md5')
        content_type = TYPES.get(path.suffix.lower(), mimetypes.guess_type(path.name)[0] or 'application/octet-stream')
        if not hasattr(local, 'session'):
            local.session = requests.Session()
        session = local.session
        url = BASE + '/' + quote(key, safe='/')

        def check():
            throttle()
            response = session.head(url, timeout=60)
            if response.status_code == 404:
                return False
            response.raise_for_status()
            if int(response.headers.get('Content-Length', -1)) != size or response.headers.get('Content-Type', '').split(';')[0] != content_type:
                return False
            etag = response.headers.get('ETag', '').strip('"')
            if '-' not in etag:
                return etag == md5
            remote_hash = hashlib.md5()
            throttle()
            with session.get(url, stream=True, timeout=120) as download:
                download.raise_for_status()
                for chunk in download.iter_content(1024 * 1024):
                    remote_hash.update(chunk)
            return remote_hash.hexdigest() == md5

        uploaded = False
        for attempt in range(4):
            try:
                if check():
                    return {'object_key': key, 'bytes': size, 'md5': md5, 'content_type': content_type, 'uploaded': uploaded, 'verified': True}
                if args.verify_only:
                    raise ValueError(f'Remote missing or mismatched: {key}')
                api = f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/r2/buckets/{BUCKET}/objects/' + quote(key, safe='/')
                with path.open('rb') as handle:
                    response = session.put(api, headers={'Authorization': 'Bearer '+token, 'Content-Type': content_type, 'Cache-Control': 'public, max-age=31536000, immutable'}, data=handle, timeout=300)
                response.raise_for_status()
                uploaded = True
                if check():
                    return {'object_key': key, 'bytes': size, 'md5': md5, 'content_type': content_type, 'uploaded': True, 'verified': True}
                raise ValueError(f'Post-upload verification failed: {key}')
            except Exception:
                if attempt == 3:
                    raise
                time.sleep(2 ** attempt)

    failures = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        jobs = {pool.submit(worker, item): item[0] for item in objects.items()}
        for job in concurrent.futures.as_completed(jobs):
            completed += 1
            try:
                results.append(job.result())
            except Exception as error:
                # Never print request headers or the OAuth configuration.
                failures.append({'object_key': jobs[job], 'error': str(error)})
                print('FAILED', jobs[job], type(error).__name__, flush=True)
            if completed % 25 == 0 or completed == len(jobs):
                print(f'Checked {completed}/{len(jobs)}; uploaded {sum(r["uploaded"] for r in results)}; failures {len(failures)}', flush=True)
    report = {'bucket': BUCKET, 'public_base_url': BASE, 'verified_count': len(results), 'uploaded_count': sum(r['uploaded'] for r in results), 'failures': failures, 'objects': sorted(results, key=lambda r: r['object_key'])}
    report_path.write_text(json.dumps(report, indent=2)+'\n', encoding='utf8')
    if failures:
        raise SystemExit(f'{len(failures)} media objects failed; see {report_path.relative_to(ROOT).as_posix()}')
    print(f'Verified {len(results)} public R2 objects by content hash, size and MIME type.')

if __name__ == '__main__':
    main()

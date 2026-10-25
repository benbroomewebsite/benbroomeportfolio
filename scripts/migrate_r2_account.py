"""Copy the verified local mirror to Ben's account; never delete objects."""
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import threading
import time
import tomllib
from urllib.parse import quote
import requests

ROOT = Path(__file__).resolve().parents[1]
ACCOUNT = '856d30a7c55ce0475ebcac06e973dc57'
BUCKET = 'benbroome-portfolio-media'
API = f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/r2/buckets/{BUCKET}'

def main():
    token = tomllib.loads((Path(os.environ['APPDATA']) / 'xdg.config/.wrangler/config/default.toml').read_text())['oauth_token']
    state = threading.local()
    def session():
        if not hasattr(state, 'session'):
            state.session = requests.Session()
            state.session.headers.update({'Authorization': 'Bearer ' + token, 'Accept-Encoding': 'identity'})
        return state.session
    def request(method, url, **kwargs):
        response = session().request(method, url, timeout=300, **kwargs)
        response.raise_for_status()
        return response
    def inventory():
        result, cursor = [], None
        while True:
            data = request('GET', API + '/objects', params={'per_page':1000, 'cursor':cursor} if cursor else {'per_page':1000}).json()
            if not data.get('success'): raise RuntimeError('Inventory failed')
            result.extend(data['result'])
            info = data.get('result_info', {})
            if not info.get('is_truncated'): return {o['key']:o for o in result}
            next_cursor = info.get('cursor')
            if not next_cursor or next_cursor == cursor: raise RuntimeError('Invalid cursor')
            cursor = next_cursor
    source = json.loads((ROOT / 'docs/r2-mirror/inventory.json').read_text())['objects']
    verified = {o['key']:o for o in json.loads((ROOT / 'docs/r2-mirror/verification.json').read_text())['objects']}
    request('GET', API)
    existing = inventory()
    print(f'Destination confirmed: {ACCOUNT}/{BUCKET}; {len(existing)} existing objects', flush=True)
    # Verify the entire source before writing any destination object.
    hashes = {}
    for obj in source:
        path = ROOT / 'r2-bucket' / obj['key']
        if not path.resolve().is_relative_to((ROOT / 'r2-bucket').resolve()): raise ValueError('Unsafe key')
        with path.open('rb') as handle: sha = hashlib.file_digest(handle, 'sha256').hexdigest()
        if path.stat().st_size != obj['size'] or sha != verified[obj['key']]['sha256']: raise ValueError('Local mirror mismatch: '+obj['key'])
        with path.open('rb') as handle: hashes[obj['key']] = hashlib.file_digest(handle, 'md5').hexdigest()
    print(f'All {len(source)} local files verified by SHA-256', flush=True)
    def matches(remote, obj):
        return remote and remote['size'] == obj['size'] and remote['etag'].strip('"') == hashes[obj['key']] and remote.get('http_metadata', {}) == obj.get('http_metadata', {}) and remote.get('custom_metadata', {}) == obj.get('custom_metadata', {})
    def upload(obj):
        key = obj['key']
        if matches(existing.get(key), obj): return 'reused'
        metadata = obj.get('http_metadata', {})
        if obj.get('custom_metadata'): raise ValueError('Custom metadata unsupported')
        headers = {h:metadata[k] for k,h in [('contentType','Content-Type'),('cacheControl','Cache-Control')] if k in metadata}
        for attempt in range(4):
            try:
                with (ROOT / 'r2-bucket' / key).open('rb') as handle:
                    request('PUT', API + '/objects/' + quote(key, safe='/'), headers=headers, data=handle)
                return 'uploaded'
            except requests.RequestException:
                if attempt == 3: raise
                time.sleep(2 ** attempt)
    failures, count, uploaded = [], 0, 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        jobs = {pool.submit(upload,o):o['key'] for o in source}
        for job in concurrent.futures.as_completed(jobs):
            count += 1
            try: uploaded += job.result() == 'uploaded'
            except Exception as error: failures.append({'key':jobs[job], 'error':type(error).__name__})
            if count % 25 == 0 or count == len(source): print(f'Processed {count}/{len(source)}; uploaded {uploaded}; failures {len(failures)}', flush=True)
    destination = inventory()
    mismatches = [o['key'] for o in source if not matches(destination.get(o['key']),o)]
    extras = sorted(set(destination)-{o['key'] for o in source})
    report = {'account':ACCOUNT, 'bucket':BUCKET, 'object_count':len(destination), 'total_bytes':sum(o['size'] for o in destination.values()), 'uploaded':uploaded, 'failures':failures, 'mismatches':mismatches, 'extra_keys':extras, 'objects':list(destination.values())}
    (ROOT / 'docs/r2-mirror/ben-migration-verification.json').write_text(json.dumps(report,indent=2)+'\n')
    if failures or mismatches or extras: raise RuntimeError('Destination verification incomplete; see migration report')
    print(f'VERIFIED: {len(destination)} objects / {report["total_bytes"]} bytes; all keys, MD5 hashes and metadata match.', flush=True)

if __name__ == '__main__': main()

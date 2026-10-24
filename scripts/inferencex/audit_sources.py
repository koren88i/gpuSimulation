"""Download small, public aggregate artifacts for selected source-run audits.

Uses the existing gh login, never prints credentials, and never extracts ZIP paths.
Large request traces/server logs are not downloaded by this script.
"""
import json
import hashlib
import subprocess
import sys
from pathlib import Path
from zipfile import ZipFile
from io import BytesIO

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'data/inferencex/audit'
OUT.mkdir(parents=True, exist_ok=True)
ROWS = ['439841', '439969', '439975', '441056', '441057', '441058', '439949', '440078']
all_qualified = '--all-qualified' in sys.argv
if all_qualified:
    comparisons = json.loads((ROOT / 'reports/inferencex/comparisons.json').read_text('utf8'))['comparisons']
    ROWS = sorted({c[k] for c in comparisons if c['policy'] == 'latency_qualified_sessions'
                   and c['largeActiveSessions'] is not None and c['splitActiveSessions'] is not None
                   for k in ('smallId', 'largeId')})
manifest_name = 'manifest-qualified.json' if all_qualified else 'manifest.json'
rows = json.loads((ROOT / 'reports/inferencex/benchmarks.json').read_text('utf8'))
selected = [r for r in rows if r['id'] in ROWS]
manifest = {'selectedIds': ROWS, 'runs': [], 'artifacts': [], 'errors': []}

def api(path):
    result = subprocess.run(['gh', 'api', path], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        raise RuntimeError(result.stderr.decode('utf8', errors='replace'))
    return result.stdout

def save_api(path, filename):
    target = OUT / filename
    if not target.exists():
        target.write_bytes(api(path))
    return json.loads(target.read_bytes())

run_ids = sorted({r['runUrl'].split('/runs/')[1].split('/')[0] for r in selected})
for run_id in run_ids:
    try:
        run = save_api(f'repos/SemiAnalysisAI/InferenceX/actions/runs/{run_id}', f'run-{run_id}.json')
        manifest['runs'].append({'id': run_id, 'sha': run['head_sha'], 'url': run['html_url']})
        source_path = OUT / f"request-accounting-{run['head_sha']}.py"
        if not source_path.exists():
            code = subprocess.run(['git', '-C', str(ROOT / 'research-inferencex'), 'show',
                f"{run['head_sha']}:utils/agentic/aggregation/request_metrics.py"],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if code.returncode == 0:
                source_path.write_bytes(code.stdout)
        page = 1
        while True:
            jobs = save_api(f'repos/SemiAnalysisAI/InferenceX/actions/runs/{run_id}/jobs?filter=all&per_page=100&page={page}', f'jobs-{run_id}-{page}.json')
            if len(jobs['jobs']) < 100:
                break
            page += 1
        artifacts = []
        page = 1
        while True:
            payload = save_api(f'repos/SemiAnalysisAI/InferenceX/actions/runs/{run_id}/artifacts?per_page=100&page={page}', f'artifacts-{run_id}-{page}.json')
            artifacts.extend(payload['artifacts'])
            if len(payload['artifacts']) < 100:
                break
            page += 1
        wanted = [r for r in selected if f'/runs/{run_id}/' in r['runUrl']]
        for a in artifacts:
            if not a['name'].startswith('bmk_agentic_') or a['size_in_bytes'] > 5_000_000:
                continue
            if not any(f"_{r['model']}_" in a['name'] and f"_{r['hardware']}-" in a['name'] for r in wanted):
                continue
            path = OUT / f"artifact-{a['id']}.zip"
            try:
                if not path.exists():
                    path.write_bytes(api(f"repos/SemiAnalysisAI/InferenceX/actions/artifacts/{a['id']}/zip"))
                body = path.read_bytes()
                records = []
                with ZipFile(BytesIO(body)) as archive:
                    for name in archive.namelist():
                        if name.endswith('.json'):
                            records.append({'filename': name, 'data': json.loads(archive.read(name))})
                (OUT / f"artifact-{a['id']}.json").write_text(json.dumps(records, indent=2), encoding='utf8')
                manifest['artifacts'].append({'id': a['id'], 'runId': run_id, 'name': a['name'],
                    'sha256': hashlib.sha256(body).hexdigest(), 'source': a['archive_download_url'],
                    'file': f"data/inferencex/audit/artifact-{a['id']}.json"})
            except Exception as e:
                manifest['errors'].append({'artifactId': a['id'], 'error': str(e)})
        print(f"Audited run {run_id}; {len(manifest['artifacts'])} small artifacts", flush=True)
    except Exception as e:
        manifest['errors'].append({'runId': run_id, 'error': str(e)})
    (OUT / manifest_name).write_text(json.dumps(manifest, indent=2), encoding='utf8')
print(f"Done: {len(manifest['artifacts'])} artifacts, {len(manifest['errors'])} errors")

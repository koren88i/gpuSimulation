"""Package the reproducible extraction, excluding unrelated project files."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[2]
target = root / 'reports' / 'inferencex-bundle.zip'
folders = ['scripts/inferencex', 'data/inferencex', 'reports/inferencex']
with ZipFile(target, 'w', ZIP_DEFLATED, compresslevel=6) as bundle:
    for folder in folders:
        for path in sorted((root / folder).rglob('*')):
            if path.is_file():
                bundle.write(path, path.relative_to(root).as_posix())
    bundle.write(root / 'tests/inferencex.test.js', 'tests/inferencex.test.js')
    bundle.write(root / 'README.md', 'README.md')
    bundle.write(root / 'AGENTS.md', 'AGENTS.md')
    for path in sorted((root / 'docs').rglob('*.md')):
        bundle.write(path, path.relative_to(root).as_posix())
    bundle.writestr('package.json', '{"private":true,"type":"module"}\n')
    bundle.writestr('README.txt', 'Open reports/inferencex/shortlist.md first; see docs/HANDOFF.md for continuation.\n'
                    'Requires Node.js 24 or later. No npm dependencies.\n'
                    'From this folder: node scripts/inferencex/report.js\n'
                    'Tests: node --test tests/inferencex.test.js\n'
                    'Raw snapshots are included for offline reproduction.\n')
print(f'{target}: {target.stat().st_size:,} bytes')

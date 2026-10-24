"""Render README diagrams from frozen browser data; requires Pillow.

These are explanatory figures, not screenshots or capacity-maxima claims.
Run from any directory: python scripts/render-readme-visuals.py
"""
from pathlib import Path
import json
import subprocess
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / 'data/inferencex-ui.json').read_text(encoding='utf-8'))
OUT = ROOT / 'docs/images'
OUT.mkdir(parents=True, exist_ok=True)
BG, INK, MUTED = '#f6f5f0', '#172f2b', '#536660'
GREEN, BLUE, LINE = '#176b52', '#4769a3', '#d9e0d8'


def font(size, bold=False):
    names = ['C:/Windows/Fonts/seguisb.ttf' if bold else 'C:/Windows/Fonts/segoeui.ttf',
             '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else
             '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']
    for name in names:
        if Path(name).exists():
            return ImageFont.truetype(name, size)
    return ImageFont.truetype('DejaVuSans.ttf', size)


def canvas(height):
    im = Image.new('RGB', (1600, height), BG)
    return im, ImageDraw.Draw(im)


def text(d, x, y, value, size=26, fill=INK, bold=False):
    f = font(size, bold)
    box = d.textbbox((x, y), value, font=f)
    assert box[2] <= 1550, f'Text exceeds figure width: {value}'
    d.text((x, y), value, font=f, fill=fill)


def panel(d, bounds):
    d.rounded_rectangle(bounds, radius=24, fill='white', outline=LINE, width=2)


def number(v):
    return f'{v:,.0f}'


def budget(p):
    small = p['smallNodeEquivalents'] * p['gpusPerNode']
    large = p['largeNodeEquivalents'] * p['gpusPerNode']
    assert small * p['copies'] == large
    return small, large


def overview():
    p = next(p for p in DATA['shortlist'] if p['smallId'] == '439969' and p['largeId'] == '439975')
    small, large = budget(p)
    im, d = canvas(1040)
    text(d, 64, 36, 'INFERENCE REPORT EXPLORER', 22, GREEN, True)
    text(d, 64, 83, 'One model. Several deployment options.', 57, bold=True)
    text(d, 64, 165, 'Select a model, browse hardware, then inspect an equal-GPU comparison.', 29, MUTED)
    panel(d, (64, 237, 1536, 377))
    text(d, 92, 260, 'DeepSeek V4 Pro', 35, bold=True)
    text(d, 92, 315, 'Hardware with included comparisons', 23, MUTED)
    hardware = sorted({r['hardware'].upper() for r in DATA['pairs'] if r['model'] == p['model']})
    for i, label in enumerate(hardware):
        left = 715 + 195 * i
        d.rounded_rectangle((left, 277, left + 166, 337), 16,
                            fill=GREEN if label == p['hardware'].upper() else '#edf0e9')
        text(d, left + 28, 287, label, 29, 'white' if label == p['hardware'].upper() else INK, True)
    text(d, 64, 410, f"Example: {large:g} {p['hardware'].upper()} GPUs on each side", 32, bold=True)
    panel(d, (64, 474, 781, 805))
    panel(d, (809, 474, 1536, 805))
    text(d, 92, 495, 'INDEPENDENT COPIES · MODELED SPLIT', 23, BLUE, True)
    text(d, 837, 495, 'LARGER ALLOCATION · MEASURED', 23, GREEN, True)
    text(d, 92, 544, f"{small:g} GPUs × {p['copies']} = {large:g} GPUs", 43, bold=True)
    text(d, 837, 544, f'One {large:g}-GPU deployment', 43, bold=True)
    text(d, 92, 620, f"{number(p['splitOutputTps'] / p['copies'])} × {p['copies']} = {number(p['splitOutputTps'])} tokens/s", 32, BLUE, True)
    text(d, 837, 620, f"{number(p['largeOutputTps'])} output tokens/s", 32, GREEN, True)
    text(d, 92, 678, f"{number(p['splitConcurrency'] / p['copies'])} × {p['copies']} = {number(p['splitConcurrency'])} configured root sessions", 25)
    text(d, 837, 678, f"{number(p['largeConcurrency'])} configured root sessions", 25)
    text(d, 92, 736, f"p90 first token: {p['smallP90Ttft']:.2f} s per request", 24, MUTED)
    text(d, 837, 736, f"p90 first token: {p['largeP90Ttft']:.2f} s per request", 24, MUTED)
    text(d, 64, 839, f"Larger allocation: {p['throughputGainPct']:+.1f}% throughput at these selected loads.", 31, GREEN, True)
    text(d, 64, 898, 'The split baseline scales a measured smaller deployment; latency is never multiplied.', 25, MUTED)
    text(d, 64, 945, 'Configured sessions are tested loads, not proven maxima. Source evidence is included.', 25, MUTED)
    im.save(OUT / 'compare-model-setups.png', optimize=True)


def outcomes():
    rows = [next(p for p in DATA['pairs'] if p['id'] == key) for key in (
        'latency_qualified_sessions:439949:440078:4',
        'latency_qualified_sessions:439929:440967:6')]
    assert len({p['model'] for p in rows}) == 1
    im, d = canvas(1120)
    text(d, 64, 36, 'SAME MODEL · DIFFERENT SETUPS', 22, GREEN, True)
    text(d, 64, 83, 'GLM-5.2: the setup changes the outcome.', 54, bold=True)
    text(d, 64, 162, 'Selected-load output throughput · equal GPU budgets within each comparison', 28, MUTED)
    for i, p in enumerate(rows):
        small, large = budget(p)
        y = 242 + 334 * i
        panel(d, (64, y, 1536, y + 304))
        text(d, 94, y + 20, f"{p['hardware'].upper()} · {large:g} GPUs per side", 34, bold=True)
        text(d, 1110, y + 26, f"Larger {p['throughputGainPct']:+.1f}%", 31,
             GREEN if p['throughputGainPct'] >= 0 else '#925638', True)
        maximum = max(p['splitOutputTps'], p['largeOutputTps'])
        for j, (label, value, color) in enumerate((
            (f"Split: {small:g} GPUs × {p['copies']} = {large:g} GPUs", p['splitOutputTps'], BLUE),
            (f'Larger: one {large:g}-GPU deployment', p['largeOutputTps'], GREEN))):
            yy = y + 100 + j * 80
            text(d, 94, yy, label, 25)
            width = round(590 * value / maximum)
            d.rounded_rectangle((635, yy + 3, 635 + width, yy + 38), 8, fill=color)
            text(d, 1252, yy - 2, f'{number(value)} tok/s', 26, color, True)
        text(d, 94, y + 256, f"Source point IDs: {p['smallId']} / {p['largeId']} · split total includes all copies", 22, MUTED)
    text(d, 64, 930, 'Compare the tradeoffs; the larger allocation does not always win.', 31, bold=True)
    text(d, 64, 986, 'Bars scale within each panel. These are separate comparisons, not a hardware ranking.', 25, MUTED)
    text(d, 64, 1030, 'Sparse sweeps and software differences remain; these results do not prove capacity maxima.', 24, MUTED)
    im.save(OUT / 'same-model-different-outcomes.png', optimize=True)


def funnel():
    # Reuse the explorer's own stage definitions rather than duplicate its filters.
    js = """import {readFileSync} from 'node:fs';
import {selectionSummary} from './report/selection.js';
const data=JSON.parse(readFileSync('data/inferencex-ui.json','utf8'));
console.log(JSON.stringify(selectionSummary(data).stages));"""
    stages = json.loads(subprocess.check_output(
        ['node', '--input-type=module', '-e', js], cwd=ROOT, encoding='utf-8'))
    im, d = canvas(1310)
    text(d, 64, 36, 'THE SELECTION FUNNEL', 22, GREEN, True)
    text(d, 64, 83, 'From benchmark measurements to examples.', 53, bold=True)
    text(d, 64, 162, 'A visual guide to the collections you can explore in the report.', 28, MUTED)
    colors = ['#e7ece5', '#d8e7dd', '#c5dfd0', '#acd2be', '#176b52']
    subtitles = [
        'Individual benchmark points in the research snapshot',
        'Equal GPU budgets; records span selection policies',
        'Agentic coding workload; records span policies',
        'Session estimates within the shared latency limits',
        'Editorial subset; not the only eligible comparisons',
    ]
    for i, ((label, count, _), subtitle) in enumerate(zip(stages, subtitles)):
        y = 260 + i * 158
        left, right = 64 + i * 40, 1064 - i * 40
        d.polygon([(left, y), (right, y), (right - 22, y + 120),
                   (left + 22, y + 120)], fill=colors[i])
        color = 'white' if i == len(stages) - 1 else INK
        text(d, left + 34, y + 15, number(count), 43, color, True)
        text(d, left + 215 if i == 0 else left + 145, y + 28,
             label, 27, color, True)
        text(d, left + 34, y + 78, subtitle, 21, color)
        if i < len(stages) - 1:
            d.line((564, y + 126, 564, y + 143), fill=MUTED, width=3)
            d.polygon([(556, y + 140), (572, y + 140), (564, y + 150)], fill=MUTED)
    panel(d, (1114, 260, 1536, 1012))
    text(d, 1140, 286, 'HOW TO READ THIS', 22, GREEN, True)
    for i, line in enumerate([
        'The first stage counts points.',
        'Later stages count records.',
        'Records can reuse points.',
        'This is not a conversion rate.',
    ]):
        text(d, 1140, 342 + i * 45, line, 23, MUTED)
    d.line((1140, 555, 1508, 555), fill=LINE, width=2)
    text(d, 1140, 584, 'SOURCE AUDIT', 23, GREEN, True)
    counts = DATA['sourceAudit']['counts']['pairs']
    text(d, 1140, 633, f"{number(sum(counts.values()))} qualified pairs checked", 25, bold=True)
    text(d, 1140, 686, f"{number(counts.get('verified', 0))} verified", 32, GREEN, True)
    text(d, 1140, 739, f"{number(counts.get('incomplete', 0))} incomplete", 32, '#925638', True)
    text(d, 1140, 808, 'Audit status is separate', 24, MUTED)
    text(d, 1140, 848, 'from editorial selection.', 24, MUTED)
    text(d, 1140, 918, 'Neither proves maximum', 23, MUTED)
    text(d, 1140, 954, 'production capacity.', 23, MUTED)
    text(d, 64, 1063, 'The five examples are a starting point. All comparison records remain accessible.', 30, bold=True)
    text(d, 64, 1126, 'Shapes show selection steps, not percentages or proportional quantities.', 26, MUTED)
    text(d, 64, 1175, 'Counts come from the same frozen data and selection logic used by the explorer.', 26, MUTED)
    text(d, 64, 1224, 'Source verification checks evidence; it does not establish capacity maxima.', 26, MUTED)
    im.save(OUT / 'selection-funnel.png', optimize=True)


overview()
outcomes()
funnel()
print('README diagrams generated from data/inferencex-ui.json')

"""Render README diagrams from frozen browser data; requires Pillow.

These are explanatory figures, not screenshots or capacity-maxima claims.
Run from any directory: python scripts/render-readme-visuals.py
"""
from pathlib import Path
import json
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


overview()
outcomes()
print('README diagrams generated from data/inferencex-ui.json')

#!/usr/bin/env python3
"""Pixel-compare two capture phases view by view.

Written to prove the dead-CSS removal (REPORT §69.12) changed nothing that renders: every selector removed was
supposed to be unreachable, and the only way to show that is to re-capture and compare. Reports, per view, the
share of differing pixels and the largest channel delta, plus any view present in one phase and not the other.

Usage: python3 scripts/qa/v10-pixdiff.py <phase-a> <phase-b> [--tol N]
"""
import sys
from pathlib import Path

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[2] / 'docs' / 'qa' / 'v10'
a_dir, b_dir = ROOT / sys.argv[1], ROOT / sys.argv[2]
tol = int(sys.argv[sys.argv.index('--tol') + 1]) if '--tol' in sys.argv else 2

rel = lambda d: {p.relative_to(d).as_posix() for p in d.rglob('*.png')}
only_a, only_b = sorted(rel(a_dir) - rel(b_dir)), sorted(rel(b_dir) - rel(a_dir))
both = sorted(rel(a_dir) & rel(b_dir))

worst, changed = [], 0
for name in both:
    ia = Image.open(a_dir / name).convert('RGB')
    ib = Image.open(b_dir / name).convert('RGB')
    if ia.size != ib.size:
        worst.append((1.0, max(abs(ia.size[0] - ib.size[0]), abs(ia.size[1] - ib.size[1])), f'{name} SIZE {ia.size} → {ib.size}'))
        changed += 1
        continue
    diff = ImageChops.difference(ia, ib).convert('L')
    # Pixels differing by more than the tolerance; JPEG-free PNGs make this exact, so the tolerance only absorbs
    # sub-pixel text rasterisation, which differs run to run even with no change at all.
    hist = diff.point(lambda v: 255 if v > tol else 0).histogram()
    bad = hist[255]
    if bad:
        changed += 1
        worst.append((bad / (ia.size[0] * ia.size[1]), max(i for i, c in enumerate(diff.histogram()) if c), name))

worst.sort(reverse=True)
print(f'{len(both)} views compared · {changed} differ beyond tol={tol} · {len(only_a)} only in {sys.argv[1]} · {len(only_b)} only in {sys.argv[2]}')
for frac, delta, name in worst[:25]:
    print(f'  {frac * 100:7.3f}%  max delta {delta:3}  {name}')
for n in only_a[:10]:
    print(f'  only in {sys.argv[1]}: {n}')
for n in only_b[:10]:
    print(f'  only in {sys.argv[2]}: {n}')

#!/usr/bin/env python3
"""Merge translation keys into locale bundles, keeping the files' 2-space JSON layout.

    python3 scripts/i18n/add-keys.py <spec.json>

spec = { "<namespace>": { "<locale>": { nested keys … } } }. Existing keys are overwritten; nothing else changes.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / 'packages' / 'i18n' / 'locales'


def merge(dst, src):
    for k, v in src.items():
        if isinstance(v, dict) and isinstance(dst.get(k), dict):
            merge(dst[k], v)
        else:
            dst[k] = v


spec = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
for ns, by_locale in spec.items():
    for loc, keys in by_locale.items():
        f = ROOT / loc / f'{ns}.json'
        data = json.loads(f.read_text(encoding='utf-8')) if f.exists() else {}
        merge(data, keys)
        f.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'{loc}/{ns}.json')

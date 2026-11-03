#!/usr/bin/env python3
"""V30 codemod: toolbar `<Select aria-label=…>` → `<FilterSelect label=…>` (REPORT §409).

A toolbar filter in this codebase is recognisable by its name living in `aria-label` (no visible <Field> label):
that is exactly what made the category invisible. `--list` prints every candidate with its enclosing context;
`--apply file:line,…` converts the chosen ones (others stay `Select`). Tag ends are found by brace depth, so
`onChange={(e) => …}` arrows do not end the tag early.
"""
import re, sys, pathlib

def tags(src):
    for m in re.finditer(r'<Select\b', src):
        i, depth = m.end(), 0
        while i < len(src):
            c = src[i]
            if c == '{': depth += 1
            elif c == '}': depth -= 1
            elif c == '>' and depth == 0: break
            i += 1
        yield m.start(), i + 1, src[m.start():i + 1]

def candidates(path):
    src = path.read_text()
    for start, end, tag in tags(src):
        if 'aria-label=' not in tag: continue
        line = src.count('\n', 0, start) + 1
        yield line, start, end, tag

mode = sys.argv[1]
files = [p for d in ('apps/agency-web/src', 'apps/university-web/src', 'apps/student-web/src') for p in pathlib.Path(d).rglob('*.tsx')]
if mode == '--list':
    for f in files:
        lines = f.read_text().split('\n')
        for line, _, _, tag in candidates(f):
            ctx = ' / '.join(l.strip()[:50] for l in lines[max(0, line - 4):line - 1] if re.search(r'className|<td|<th|Toolbar|FilterBar|Drawer|cell', l))
            lab = re.search(r'aria-label=\{([^}]*\)?)\}', tag)
            print(f'{f}:{line}\t{lab.group(1)[:50] if lab else tag[:60]}\t{ctx[:110]}')
elif mode == '--apply':
    chosen = set(sys.argv[2].split(','))
    for f in files:
        src = f.read_text(); out = []; pos = 0; changed = 0
        for line, start, end, tag in candidates(f):
            if f'{f}:{line}' not in chosen: continue
            new = tag.replace('<Select', '<FilterSelect', 1).replace('aria-label=', 'label=', 1)
            new = re.sub(r'\s+compact(?=[\s>/])', '', new)
            new = new.replace('<FilterSelect', '<FilterSelect size="sm"', 1)
            close = src.index('</Select>', end)
            out.append(src[pos:start]); out.append(new); out.append(src[end:close]); out.append('</FilterSelect>')
            pos = close + len('</Select>'); changed += 1
        if changed:
            out.append(src[pos:]); src = ''.join(out)
            # import FilterSelect next to Select from @hangyul/ui
            src = re.sub(r"import \{([^}]*)\bSelect\b([^}]*)\} from '@hangyul/ui';", lambda m: m.group(0) if 'FilterSelect' in m.group(0) else m.group(0).replace(' Select,', ' FilterSelect, Select,', 1) if ' Select,' in m.group(0) else m.group(0).replace('Select', 'FilterSelect, Select', 1), src, count=1)
            if '<Select' not in src:   # no plain Select left: drop it from the import
                src = re.sub(r"(import \{[^}]*?)\bFilterSelect, Select\b", r"\1FilterSelect", src, count=1)
            f.write_text(src); print(f, changed)

#!/usr/bin/env python3
"""Check text and UI-border contrast using the colour tokens in src/template.html (light and dark).
Exit code 1 if any pair is below WCAG AA (4.5:1 text, 3:1 non-text)."""
import os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
css = open(os.path.join(ROOT, 'src', 'template.html'), encoding='utf-8').read()

def tokens(block):
    return {k: v for k, v in re.findall(r'--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})', block)}
light = tokens(re.search(r':root\{(.*?)\n\}', css, re.S).group(1))
dark = dict(light); dark.update(tokens(re.search(r':root\[data-theme="dark"\]\{(.*?)\}', css, re.S).group(1)))

def lum(h):
    h = h.lstrip('#'); c = [int(h[i:i+2], 16)/255 for i in (0, 2, 4)]
    f = lambda x: x/12.92 if x <= 0.03928 else ((x+0.055)/1.055)**2.4
    return 0.2126*f(c[0]) + 0.7152*f(c[1]) + 0.0722*f(c[2])
def cr(a, b):
    la, lb = lum(a), lum(b); return (max(la, lb)+0.05)/(min(la, lb)+0.05)
def mix(fg, bg, a):
    f = [int(fg[i:i+2], 16) for i in (1, 3, 5)]; b = [int(bg[i:i+2], 16) for i in (1, 3, 5)]
    return '#%02x%02x%02x' % tuple(round(f[i]*a + b[i]*(1-a)) for i in range(3))

fails = 0
for mode, T in (('light', light), ('dark', dark)):
    pill = mix('#000000', T['felt'], .28)
    pairs = [
      ('ink on page', T['ink'], T['page'], 4.5), ('muted on page', T['muted'], T['page'], 4.5),
      ('muted on surface', T['muted'], T['surface'], 4.5),
      ('muted on note box', T['muted'], mix(T['ink'], T['page'], .05), 4.5),
      ('felt-muted on felt', T['felt-muted'], T['felt'], 4.5), ('felt-ink on felt', T['felt-ink'], T['felt'], 4.5),
      ('felt-ink on pill', T['felt-ink'], pill, 4.5), ('accent-ink on accent', T['accent-ink'], T['accent'], 4.5),
      ('good on good-bg', T['good'], T['good-bg'], 4.5), ('warn on warn-bg', T['warn'], T['warn-bg'], 4.5),
      ('bad on bad-bg', T['bad'], T['bad-bg'], 4.5), ('placeholder on page', T['placeholder'], T['page'], 4.5),
      ('red suit on card', T['red'], T['card'], 4.5), ('focus ring on page (non-text)', T['focus'], T['page'], 3.0),
      ('button/input border on surface (non-text)', T['line-strong'], T['surface'], 3.0),
      ('button/input border on page (non-text)', T['line-strong'], T['page'], 3.0),
    ]
    for name, a, b, need in pairs:
        r = cr(a, b); ok = r >= need; fails += (not ok)
        print(f"{mode:<6}{name:<44}{r:>6.2f}  need {need:<4} {'ok' if ok else 'FAIL'}")
print('FAILURES:', fails); sys.exit(1 if fails else 0)

#!/usr/bin/env python3
"""
Build the site from src/template.html + data/pool.json.

  python3 scripts/build.py              -> index.html (self-hosted fonts, deployed by Vercel)
                                           .build/test.html (same page + test hooks, used by the tests)
  python3 scripts/build.py --artifact   -> also .build/artifact.html (Google Fonts link, for pasting into a Claude artifact)

index.html is committed so Vercel can serve the repo as a plain static site with no build step.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RANGE = ("U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,"
         "U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD")

LOCAL_FONTS = f"""<link rel="preload" href="/fonts/young-serif-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/hanken-grotesk-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<style>
@font-face{{font-family:"Young Serif";font-style:normal;font-weight:400;font-display:swap;src:url(/fonts/young-serif-latin-400-normal.woff2) format("woff2");unicode-range:{RANGE}}}
@font-face{{font-family:"Hanken Grotesk";font-style:normal;font-weight:100 900;font-display:swap;src:url(/fonts/hanken-grotesk-latin-wght-normal.woff2) format("woff2");unicode-range:{RANGE}}}
</style>"""

GOOGLE_FONTS = """<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=Young+Serif&display=swap" rel="stylesheet">"""

def read(p):
    with open(os.path.join(ROOT, p), encoding="utf-8") as f: return f.read()

def write(p, s):
    full = os.path.join(ROOT, p); os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f: f.write(s)
    print(f"wrote {p} ({len(s.encode()):,} bytes)")

tpl = read("src/template.html"); pool = read("data/pool.json").strip()
json.loads(pool)  # fail early on bad data
assert "/*POOL*/null" in tpl and "<!--FONTS-->" in tpl
with_pool = tpl.replace("/*POOL*/null", pool)
strip_hooks = lambda s: re.sub(r"window\.__dh=\{.*?\};\n", "", s, flags=re.S)

test_page = with_pool.replace("<!--FONTS-->", LOCAL_FONTS)
write(".build/test.html", test_page)
write("index.html", strip_hooks(test_page))
if "--artifact" in sys.argv:
    write(".build/artifact.html", strip_hooks(with_pool.replace("<!--FONTS-->", GOOGLE_FONTS)))

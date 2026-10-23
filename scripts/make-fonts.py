"""Rebuild resources/fonts from the Noto Sans zips downloaded from Google Fonts (one or more).

    python3 -m venv /tmp/fv && /tmp/fv/bin/pip install fonttools brotli
    /tmp/fv/bin/python scripts/make-fonts.py ~/Downloads/Noto_Sans,Noto_Sans_JP,Noto_Sans_KR,Noto_Sans_TC.zip ~/Downloads/Noto_Sans_SC.zip \\
        ~/Downloads/Noto_Serif,Noto_Serif_JP,Noto_Serif_KR,Noto_Serif_SC,Noto_Serif_TC.zip

Only Regular and Bold are kept (Latin also keeps the italics), converted to woff2. coverage.json lists, per
family, the code points the font has, so export can give each character to the first family that covers it.
"""
import json, sys, tempfile, zipfile
from pathlib import Path
from fontTools.ttLib import TTFont

OUT = Path(__file__).resolve().parent.parent / 'resources' / 'fonts'
FAMILIES = {  # key -> (file prefix, styles to keep)
    'NotoSans': ('NotoSans', ['Regular', 'Bold', 'Italic', 'BoldItalic']),
    'NotoSansTC': ('NotoSansTC', ['Regular', 'Bold']),
    'NotoSansSC': ('NotoSansSC', ['Regular', 'Bold']),
    'NotoSansJP': ('NotoSansJP', ['Regular', 'Bold']),
    'NotoSansKR': ('NotoSansKR', ['Regular', 'Bold']),
    'NotoSerif': ('NotoSerif', ['Regular', 'Bold', 'Italic', 'BoldItalic']),
    'NotoSerifTC': ('NotoSerifTC', ['Regular', 'Bold']),
    'NotoSerifSC': ('NotoSerifSC', ['Regular', 'Bold']),
    'NotoSerifJP': ('NotoSerifJP', ['Regular', 'Bold']),
    'NotoSerifKR': ('NotoSerifKR', ['Regular', 'Bold']),
}

def ranges(codes):
    out, start, prev = [], None, None
    for c in sorted(codes):
        if start is None: start = prev = c
        elif c == prev + 1: prev = c
        else: out.append([start, prev]); start = prev = c
    if start is not None: out.append([start, prev])
    return out

def find(zips, suffix):
    """The zips differ in layout (some have a folder per family, some do not), so match on the file name."""
    for z in zips:
        for name in z.namelist():
            if name.endswith(suffix) and '/static/' in '/' + name:
                return z, name
    raise SystemExit(f'not found in any zip: {suffix}')

def main(paths):
    OUT.mkdir(parents=True, exist_ok=True)
    coverage = {}
    zips = [zipfile.ZipFile(p) for p in paths]
    with tempfile.TemporaryDirectory() as tmp:
        for key, (prefix, styles) in FAMILIES.items():
            for style in styles:
                z, name = find(zips, f'static/{prefix}-{style}.ttf')
                font = TTFont(z.extract(name, tmp))
                if style == 'Regular': coverage[key] = ranges(font.getBestCmap())
                font.flavor = 'woff2'
                font.save(OUT / f'{prefix}-{style}.woff2')
            z, name = find(zips, f'static/{prefix}-Regular.ttf')
            licence = name.rsplit('static/', 1)[0] + 'OFL.txt'
            (OUT / f'OFL-{prefix}.txt').write_bytes(z.read(licence))
    (OUT / 'coverage.json').write_text(json.dumps(coverage, separators=(',', ':')))

main(sys.argv[1:])

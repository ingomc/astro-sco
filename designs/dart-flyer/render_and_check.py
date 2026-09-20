#!/usr/bin/env python3
"""Render actual print PDFs and verify delivery files, without altering artwork."""
from pathlib import Path
import json
import re
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET

from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader, PdfWriter

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
POPPLER = shutil.which("pdftoppm") or str(Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override/pdftoppm")
VARIANTS = [("01-ausgewogen", "01  AUSGEWOGEN"),
            ("02-schriftbetont", "02  SCHRIFTBETONT"),
            ("03-motivbetont", "03  MOTIVBETONT")]
EXPECTED = """SCO-Darts Team Fülltreffer WIR SUCHEN DICH! Werde Teil vom Team
Fülltreffer. Anfänger, Hobbyspieler oder Liga-Erfahrung? Bei uns bist du willkommen!
STEELDARTS · OFFENES TRAINING Jeden Sonntag ab 18 Uhr QR-CODE FOLGT Vorher einfach
online anmelden. KURZLINK FOLGT SCO-OGV Oberfüllbach 1963 e.V."""


def normal(s):
    return re.sub(r"\s+", " ", s).strip()


def box_mm(box):
    return [round(float(x)*25.4/72, 4) for x in box]


def font_is_embedded(font):
    font = font.get_object()
    if '/DescendantFonts' in font:
        return all(font_is_embedded(f) for f in font['/DescendantFonts'])
    desc = font.get('/FontDescriptor')
    if not desc:
        return False
    desc = desc.get_object()
    return any(key in desc for key in ['/FontFile', '/FontFile2', '/FontFile3'])


def main():
    report = []
    for slug, _ in VARIANTS:
        path = ROOT / 'output/pdf' / f'fuelltreffer-a5-{slug}.pdf'
        reader = PdfReader(path)
        assert len(reader.pages) == 1, 'Expected single-sided flyer'
        page = reader.pages[0]
        assert box_mm(page.mediabox) == [0,0,154,216]
        assert box_mm(page.trimbox) == [3,3,151,213]
        assert box_mm(page.bleedbox) == [0,0,154,216]
        chunks = []
        page.extract_text(visitor_text=lambda value, *_: chunks.append(value) if value.strip() else None)
        text = normal(' '.join(chunks))
        assert text == normal(EXPECTED), f'Incorrect copy in {slug}: {text}'
        fonts = page['/Resources']['/Font']
        font_status = {key: font_is_embedded(f) for key,f in fonts.items()}
        assert all(font_status.values()), font_status
        assert not page.get('/Annots'), 'Placeholder PDF must not link to a fake URL'
        svg = ET.parse(HERE / f'fuelltreffer-a5-{slug}.svg')
        root = svg.getroot()
        assert root.attrib['width'] == '148mm' and root.attrib['height'] == '210mm'
        texts = [normal(''.join(t.itertext())) for t in root.iter('{http://www.w3.org/2000/svg}text')]
        assert normal(' '.join(texts)) == normal(EXPECTED)
        imgs = list(root.iter('{http://www.w3.org/2000/svg}image'))
        assert len(imgs) == 3, 'Expected two logos and common motif'
        assert all(im.attrib['{http://www.w3.org/1999/xlink}href'].startswith('data:image/') for im in imgs)
        qr = next(e for e in root.iter() if e.attrib.get('id') == 'qr-code-reserviert-30mm')
        assert qr.attrib['width'] == '30' and qr.attrib['height'] == '30'
        with tempfile.TemporaryDirectory(prefix='dart-flyer-') as tmp:
            writer=PdfWriter(); writer.add_page(page)
            writer.pages[0].cropbox = writer.pages[0].trimbox
            cropped=Path(tmp)/'trim.pdf'
            with cropped.open('wb') as f:
                writer.write(f)
            prefix=HERE/f'fuelltreffer-a5-{slug}'
            subprocess.run([POPPLER,'-r','300','-cropbox','-png','-singlefile',str(cropped),str(prefix)],check=True)
        with Image.open(HERE/f'fuelltreffer-a5-{slug}.png') as im:
            pixels=list(im.size)
        report.append({'variant':slug,'page_count':1,'media_mm':box_mm(page.mediabox),
                       'trim_mm':box_mm(page.trimbox),'fonts_embedded':font_status,
                       'exact_copy':True,'svg_resources_embedded':True,'png_pixels':pixels})

    board=Image.new('RGB',(1880,995),'#E8ECF1')
    draw=ImageDraw.Draw(board)
    font_dir=Path('/System/Library/Fonts/Supplemental')
    label=ImageFont.truetype(str(font_dir/'Arial Bold.ttf'),23)
    caption=ImageFont.truetype(str(font_dir/'Arial.ttf'),17)
    for i,(slug,name) in enumerate(VARIANTS):
        with Image.open(HERE/f'fuelltreffer-a5-{slug}.png') as source:
            im=source.convert('RGB')
        im.thumbnail((580,824),Image.Resampling.LANCZOS)
        x=40+i*620
        draw.text((x,26),name,font=label,fill='#0F172A')
        draw.text((x,62),'A5 · 148 × 210 mm',font=caption,fill='#526077')
        board.paste(im,(x,103))
        draw.text((x,948),'Gleicher Inhalt. Andere Gewichtung.',font=caption,fill='#526077')
    board.save(HERE/'vergleich-a5.png')
    (HERE/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False,indent=2))


if __name__ == '__main__':
    main()

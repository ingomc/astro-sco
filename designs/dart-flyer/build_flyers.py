#!/usr/bin/env python3
"""Reproducible A5 artwork: shared drawing operations create editable SVG + PDF.

Coordinates are millimetres from the top-left of the trimmed A5 page.
PDF adds 3 mm bleed; SVG and PNG previews show the 148 x 210 mm trim.
No generative processing or logo modifications are performed here.
"""
from __future__ import annotations

import base64
import hashlib
import html
import json
from pathlib import Path

from PIL import Image
from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = ROOT / "output/pdf"
WIDTH, HEIGHT, BLEED = 148, 210, 3
FONT_DIR = Path("/System/Library/Fonts/Supplemental")
pdfmetrics.registerFont(TTFont("FlyerArial", str(FONT_DIR / "Arial.ttf")))
pdfmetrics.registerFont(TTFont("FlyerArialBold", str(FONT_DIR / "Arial Bold.ttf")))
BG, ACCENT, WHITE = "#0F172A", "#B01F29", "#FFFFFF"
MUTED, LINE, RING = "#CBD5E1", "#334155", "#421C2C"
HERO = HERE / "assets/dartspieler.png"
TEAM_LOGO = ROOT / "public/sco-fuelltreffer.png"
SCO_PNG = ROOT / "public/logos/sco-logo@4x.png"
SCO_SVG = ROOT / "public/logos/sco-logo.svg"
VARIANTS = [("01-ausgewogen", "Ausgewogen"),
            ("02-schriftbetont", "Schriftbetont"),
            ("03-motivbetont", "Motivbetont")]


def data_uri(path: Path) -> str:
    mime = "image/svg+xml" if path.suffix == ".svg" else "image/png"
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


class Flyer:
    def __init__(self, slug: str, name: str):
        self.slug, self.name = slug, name
        self.path = OUT / f"fuelltreffer-a5-{slug}.pdf"
        self.pdf = canvas.Canvas(str(self.path),
                                 pagesize=((WIDTH + 2 * BLEED) * mm,
                                           (HEIGHT + 2 * BLEED) * mm),
                                 pageCompression=1, invariant=1, pdfVersion=(1, 4),
                                 initialFontName="FlyerArial", initialFontSize=10)
        self.pdf.setTitle(f"Team Fülltreffer | A5 | {name}")
        self.pdf.setAuthor("SCO-Darts Team Fülltreffer")
        self.pdf.setSubject("Mitgliederwerbung; QR-Code und Kurzlink sind Platzhalter")
        trim = (BLEED * mm, BLEED * mm,
                (WIDTH + BLEED) * mm, (HEIGHT + BLEED) * mm)
        self.pdf.setTrimBox(trim)
        self.pdf.setBleedBox((0, 0, (WIDTH + 2 * BLEED) * mm,
                             (HEIGHT + 2 * BLEED) * mm))
        self.svg = [f'<svg xmlns="http://www.w3.org/2000/svg" '
                    f'xmlns:xlink="http://www.w3.org/1999/xlink" '
                    f'width="148mm" height="210mm" viewBox="0 0 148 210">',
                    f'<title>Team Fülltreffer - {name}</title>',
                    '<desc>A5, 148 × 210 mm. Bearbeitbare Texte und eingebettete '
                    'Originalbilder. QR-Code und Kurzlink folgen.</desc>']
        self.texts, self.images = [], []
        self.clip_count = 0

    def px(self, x):
        return (x + BLEED) * mm

    def py(self, y):
        return (HEIGHT + BLEED - y) * mm

    def rect(self, x, y, w, h, fill, radius=0, stroke=None, sw=0.3, id=None):
        self.pdf.setFillColor(HexColor(fill))
        self.pdf.setLineWidth(sw * mm)
        if stroke:
            self.pdf.setStrokeColor(HexColor(stroke))
        if radius:
            self.pdf.roundRect(self.px(x), self.py(y + h), w * mm, h * mm,
                               radius * mm, fill=1, stroke=bool(stroke))
        else:
            self.pdf.rect(self.px(x), self.py(y + h), w * mm, h * mm,
                          fill=1, stroke=bool(stroke))
        identifier = f' id="{id}"' if id else ""
        self.svg.append(f'<rect{identifier} x="{x}" y="{y}" width="{w}" '
                        f'height="{h}" rx="{radius}" fill="{fill}" '
                        f'stroke="{stroke or "none"}" stroke-width="{sw}"/>')

    def circle(self, x, y, r, stroke, sw):
        self.pdf.setStrokeColor(HexColor(stroke))
        self.pdf.setLineWidth(sw * mm)
        self.pdf.circle(self.px(x), self.py(y), r * mm, stroke=1, fill=0)
        self.svg.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="none" '
                        f'stroke="{stroke}" stroke-width="{sw}"/>')

    def line(self, x1, y1, x2, y2, stroke, sw=0.3):
        self.pdf.setStrokeColor(HexColor(stroke))
        self.pdf.setLineWidth(sw * mm)
        self.pdf.line(self.px(x1), self.py(y1), self.px(x2), self.py(y2))
        self.svg.append(f'<path d="M{x1} {y1} L{x2} {y2}" fill="none" '
                        f'stroke="{stroke}" stroke-width="{sw}"/>')

    def text(self, value, x, y, pt=10, bold=False, color=WHITE,
             anchor="start", tracking=0, id=None):
        font = "FlyerArialBold" if bold else "FlyerArial"
        w = pdfmetrics.stringWidth(value, font, pt) / mm + tracking * max(0, len(value)-1)
        left = x - w / 2 if anchor == "middle" else x - w if anchor == "end" else x
        asc, desc = pdfmetrics.getAscentDescent(font, pt)
        bounds = [left, y - asc / mm, left + w, y - desc / mm]
        self.texts.append({"text": value, "font_pt": pt, "bounds_mm": bounds})
        self.pdf.setFillColor(HexColor(color))
        obj = self.pdf.beginText(self.px(left), self.py(y))
        obj.setFont(font, pt)
        obj.setCharSpace(tracking * mm)
        obj.textOut(value)
        self.pdf.drawText(obj)
        identifier = f' id="{id}"' if id else ""
        self.svg.append(f'<text{identifier} x="{x}" y="{y}" '
                        f'font-family="Arial, sans-serif" font-size="{pt / mm:.7f}" '
                        f'font-weight="{700 if bold else 400}" fill="{color}" '
                        f'letter-spacing="{tracking}" text-anchor="{anchor}">'
                        f'{html.escape(value)}</text>')
        return w

    def image(self, path, x, y, w, h=None, svg_source=None, id=None):
        with Image.open(path) as img:
            iw, ih = img.size
        h = h if h is not None else w * ih / iw
        self.pdf.drawImage(str(path), self.px(x), self.py(y+h), w*mm, h*mm, mask="auto")
        identifier = f' id="{id}"' if id else ""
        self.svg.append(f'<image{identifier} x="{x}" y="{y}" width="{w}" '
                        f'height="{h}" preserveAspectRatio="xMidYMid meet" '
                        f'xlink:href="{data_uri(svg_source or path)}"/>')
        self.images.append({"source": str(path.relative_to(ROOT)), "width_mm": w,
                            "dpi_a5": iw / (w / 25.4),
                            "dpi_a4": iw / (w / 25.4) / (210 / 148)})
        return h

    def start_clip(self, x, y, w, h):
        self.clip_count += 1
        cid = f"artwork-clip-{self.clip_count}"
        self.svg.append(f'<defs><clipPath id="{cid}"><rect x="{x}" y="{y}" '
                        f'width="{w}" height="{h}"/></clipPath></defs>'
                        f'<g clip-path="url(#{cid})">')
        self.pdf.saveState()
        p = self.pdf.beginPath()
        p.rect(self.px(x), self.py(y+h), w*mm, h*mm)
        self.pdf.clipPath(p, stroke=0, fill=0)

    def end_clip(self):
        self.svg.append('</g>')
        self.pdf.restoreState()

    def background(self, ring_x, ring_y):
        self.rect(-BLEED, -BLEED, WIDTH+2*BLEED, HEIGHT+2*BLEED, BG)
        self.rect(-BLEED, -BLEED, WIDTH+2*BLEED, BLEED+2, ACCENT)
        self.start_clip(-BLEED, -BLEED, WIDTH+2*BLEED, 150)
        self.circle(ring_x, ring_y, 37, RING, 8)
        self.circle(ring_x+5, ring_y-5, 19, "#1D2A40", 0.5)
        self.end_clip()

    def masthead(self):
        self.rect(9, 10, 1.5, 14, ACCENT)
        self.text("SCO-Darts Team", 14, 14.3, 10, color=MUTED)
        self.text("Fülltreffer", 13.6, 22, 20, bold=True)
        self.rect(103, 6, 36, 26, WHITE, radius=1.8)
        self.image(SCO_PNG, 106.5, 12.3, 8, svg_source=SCO_SVG)
        self.image(TEAM_LOGO, 119.5, 7.8, 18)

    def headline_word(self, word, x, baseline, pt, center=False, highlight=False):
        w = pdfmetrics.stringWidth(word, "FlyerArialBold", pt) / mm
        left = x-w/2 if center else x
        if highlight:
            asc, desc = pdfmetrics.getAscentDescent("FlyerArialBold", pt)
            self.rect(left-2.2, baseline-asc/mm-1.7,
                      w+4.4, (asc-desc)/mm+3, ACCENT)
        self.text(word, x, baseline, pt, bold=True,
                  anchor="middle" if center else "start", tracking=-0.08)

    def welcome(self, x=74, y=137.2, center=True, narrow=False):
        if narrow:
            self.text("Anfänger, Hobbyspieler", x, y, 10, color=MUTED)
            self.text("oder Liga-Erfahrung?", x, y+4.7, 10, color=MUTED)
            self.text("Bei uns bist du", x, y+11.8, 10, bold=True)
            self.text("willkommen!", x, y+16.5, 10, bold=True)
        else:
            anchor = "middle" if center else "start"
            self.text("Anfänger, Hobbyspieler oder Liga-Erfahrung?", x, y,
                      10.5, color=MUTED, anchor=anchor)
            self.text("Bei uns bist du willkommen!", x, y+5.1,
                      10.5, bold=True, anchor=anchor)

    def registration(self):
        self.rect(9, 148, 130, 16, ACCENT, radius=1.8)
        self.text("STEELDARTS · OFFENES TRAINING", 74, 153.7, 10,
                  bold=True, anchor="middle", tracking=0.12)
        self.text("Jeden Sonntag ab 18 Uhr", 74, 160.8, 18,
                  bold=True, anchor="middle")
        self.rect(9, 168, 130, 33, WHITE, radius=1.8, id="anmeldung")
        self.svg.append('<g id="qr-code-platzhalter">')
        self.rect(10.5, 169.5, 30, 30, WHITE, id="qr-code-reserviert-30mm")
        # Intentionally a labelled blank reservation, never a fake QR code.
        for x, y, sx, sy in [(12,171,1,1),(39,171,-1,1),
                              (12,198,1,-1),(39,198,-1,-1)]:
            self.line(x,y,x+sx*3.5,y,LINE,0.4)
            self.line(x,y,x,y+sy*3.5,LINE,0.4)
        self.text("QR-CODE", 25.5, 183.2, 10, bold=True, color=BG, anchor="middle")
        self.text("FOLGT", 25.5, 188, 10, color=LINE, anchor="middle")
        self.svg.append('</g>')
        self.line(43.5, 173, 43.5, 196, "#E2E8F0", 0.3)
        self.text("Vorher einfach", 49, 176.8, 12, bold=True, color=BG)
        self.text("online anmelden.", 49, 182.5, 12, bold=True, color=BG)
        self.text("KURZLINK FOLGT", 49, 193.8, 10.5, bold=True,
                  color=ACCENT, id="kurzlink-platzhalter")
        self.line(49, 196, 100, 196, "#E2E8F0", 0.35)
        self.text("SCO-OGV Oberfüllbach 1963 e.V.", 74, 204.1, 10,
                  color=MUTED, anchor="middle")

    def finish(self):
        self.svg.append('</svg>')
        (HERE / f"fuelltreffer-a5-{self.slug}.svg").write_text('\n'.join(self.svg), encoding="utf8")
        self.pdf.showPage()
        self.pdf.save()
        errors = []
        for item in self.texts:
            l,t,r,b = item['bounds_mm']
            if l < 5-0.05 or t < 5-0.05 or r > WIDTH-5+0.05 or b > HEIGHT-5+0.05:
                errors.append(f"Outside 5mm safe area: {item}")
            if item['font_pt'] < 10:
                errors.append(f"Text below 10pt: {item}")
        for item in self.images:
            if item['dpi_a4'] < 300:
                errors.append(f"Raster below 300dpi at A4: {item}")
        return {"variant": self.slug, "text": self.texts,
                "images": self.images, "errors": errors}


def build():
    OUT.mkdir(parents=True, exist_ok=True)
    reports = []
    for i, (slug, name) in enumerate(VARIANTS):
        f = Flyer(slug, name)
        if i == 0:
            f.background(78, 103)
            f.masthead()
            f.headline_word("WIR SUCHEN", 74, 39.5, 31, center=True)
            f.headline_word("DICH!", 74, 59.5, 53, center=True, highlight=True)
            f.text("Werde Teil vom Team Fülltreffer.", 74, 70.2, 12,
                   bold=True, anchor="middle")
            f.start_clip(5, 73, 138, 60)
            f.image(HERO, 48, 73, 52)
            f.end_clip()
            f.welcome()
        elif i == 1:
            f.background(121, 99)
            f.masthead()
            f.headline_word("WIR", 9, 43, 43)
            f.headline_word("SUCHEN", 9, 62.1, 43)
            f.headline_word("DICH!", 11.2, 87.7, 66, highlight=True)
            f.start_clip(77, 72, 66, 74)
            f.image(HERO, 88, 75, 49)
            f.end_clip()
            f.text("Werde Teil vom", 9, 101, 13, bold=True)
            f.text("Team Fülltreffer.", 9, 106.7, 13, bold=True)
            f.welcome(9, 121, narrow=True)
        else:
            f.background(119, 87)
            f.masthead()
            f.start_clip(78, 32, 65, 114)
            f.image(HERO, 81.5, 46, 61)
            f.end_clip()
            f.headline_word("WIR", 9, 47.7, 35)
            f.headline_word("SUCHEN", 9, 64.3, 30)
            f.headline_word("DICH!", 11.2, 85.5, 51, highlight=True)
            f.text("Werde Teil vom", 9, 101, 12, bold=True)
            f.text("Team Fülltreffer.", 9, 106.5, 12, bold=True)
            f.welcome(9, 121, narrow=True)
        f.registration()
        reports.append(f.finish())
    manifest = {
        "format_mm": [WIDTH, HEIGHT], "bleed_mm": BLEED, "safe_area_mm": 5,
        "qr_placeholder_mm": [30,30], "minimum_info_font_pt": 10,
        "colour_space": "DeviceRGB; no printer-specific PDF/X profile claimed",
        "font": "Arial / Arial Bold; embedded in PDF, required locally for editable SVG",
        "registration": "Placeholders only, no active link or QR code",
        "artwork": {"tool": "Built-in ImageGen", "source_pixels": list(Image.open(HERO).size),
                    "sha256": hashlib.sha256(HERO.read_bytes()).hexdigest()},
        "official_logos": {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
                           for p in [TEAM_LOGO, SCO_SVG, SCO_PNG]},
        "variants": reports,
    }
    (HERE / "preflight.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    for report in reports:
        print(report['variant'], 'PASS' if not report['errors'] else report['errors'])
    if any(report['errors'] for report in reports):
        raise SystemExit('Layout preflight failed')


if __name__ == '__main__':
    build()

# Team Fülltreffer: drei A5-Layoutvarianten

## Neuer Gesamtentwurf mit GPT Image

Auf ausdrücklichen Wunsch wurde anschließend der komplette Flyer einschließlich Typografie und Bildgestaltung mit GPT Image neu erzeugt: [PNG öffnen](fuelltreffer-a5-gpt-image.png). Die bisherige Variante 03 diente als Referenz. Dies ist ein flach gerasterter Bildentwurf mit Anmeldeplatzhaltern, keine bearbeitbare SVG und keine geprüfte Druck-PDF. Den genauen Generierungsprompt enthält [flyer-gpt-image-prompt.txt](assets/flyer-gpt-image-prompt.txt).

## Vorherige Layoutvarianten

Die drei Varianten verwenden denselben Text, dieselben unveränderten Logos und dasselbe generierte Dart-Motiv. Nur Anordnung und Proportionen unterscheiden sich.

**Ausgewählter Favorit: Variante 03 - Motivbetont.** Der Nutzer hat am 5. September 2026 Variante 3 gewählt. QR-Code und Kurzlink bleiben bis zur Bereitstellung der Anmeldung als Platzhalter erhalten.

| Variante | Vorschau | Bearbeitbar | PDF mit Beschnitt |
| --- | --- | --- | --- |
| 01 - Ausgewogen | [PNG](fuelltreffer-a5-01-ausgewogen.png) | [SVG](fuelltreffer-a5-01-ausgewogen.svg) | [PDF](../../output/pdf/fuelltreffer-a5-01-ausgewogen.pdf) |
| 02 - Schriftbetont | [PNG](fuelltreffer-a5-02-schriftbetont.png) | [SVG](fuelltreffer-a5-02-schriftbetont.svg) | [PDF](../../output/pdf/fuelltreffer-a5-02-schriftbetont.pdf) |
| **03 - Motivbetont (Favorit)** | [PNG](fuelltreffer-a5-03-motivbetont.png) | [SVG](fuelltreffer-a5-03-motivbetont.svg) | [PDF](../../output/pdf/fuelltreffer-a5-03-motivbetont.pdf) |

`vergleich-a5.png` zeigt alle drei Entwürfe nebeneinander. Die einzelnen PNGs sind Vorschauen des beschnittenen Endformats. Die SVG-Dateien enthalten bearbeitbare Texte und eingebettete Bildressourcen. Die zugehörigen PDFs liegen unter `../../output/pdf/`.

## Druckdaten

- Endformat: 148 × 210 mm (A5 Hochformat), einseitig.
- PDF-Seitenformat einschließlich Beschnitt: 154 × 216 mm.
- TrimBox: exakt A5, umlaufend 3 mm Beschnitt; BleedBox entspricht dem Seitenformat.
- Mindestens 5 mm Sicherheitsabstand für Texte; kleinste Schrift 10 pt.
- Arial und Arial Bold sind in den PDFs eingebettet. Für Textbearbeitung der SVGs müssen diese Schriften installiert sein; Schriftdateien werden nicht weitergegeben.
- Farben: RGB entsprechend den Website-Farben. Es wird kein bestimmtes Druckerei-Farbprofil und keine PDF/X-Zertifizierung behauptet. Vor der Bestellung die Datenvorgaben der gewählten Druckerei berücksichtigen.
- Rastermotiv unverändert aus ImageGen mit 1024 × 1536 Pixeln; maximale Platzierungsbreite 61 mm. Dadurch bleiben selbst bei späterer Vergrößerung auf A4 mindestens 300 dpi erhalten. Texte und geometrische Elemente bleiben Vektoren. Das bestehende Fülltreffer-Logo ist eine unverändert eingebettete Rasterdatei; das originale SCO-SVG bleibt in den SVG-Layouts erhalten.
- Keine A4-Dateien erstellt. Für A4 die ausgewählte Anordnung proportional auf das neue Endformat übertragen und dort erneut 3 mm Beschnitt setzen; den A5-Beschnitt nicht einfach mitskalieren.

## QR-Code und Kurzlink ersetzen

Die Dateien sind Entwürfe mit ausdrücklich gewünschten Anmeldeplatzhaltern. Sie enthalten keine funktionsfähige Anmeldung.

Im SVG heißt die Gruppe `qr-code-platzhalter`. Sie reserviert 30 × 30 mm auf Weiß. Den echten QR-Code einschließlich seiner weißen Ruhezone vollständig darin platzieren. `kurzlink-platzhalter` bezeichnet das separat bearbeitbare Kurzlink-Textfeld. Für einen reproduzierbaren Austausch dieselben Elemente in `build_flyers.py` anpassen und die Ausgaben neu bauen. Anschließend die PDF erneut rendern und den QR-Code aus einem Ausdruck bei tatsächlicher Größe scannen.

## Quellen und Wiedererstellung

- Fülltreffer-Logo: `public/sco-fuelltreffer.png`.
- SCO-Logo: `public/logos/sco-logo.svg`; hochauflösendes unverändertes PNG für PDF-Einbettung.
- Gemeinsames Motiv: `assets/dartspieler.png`, mit dem integrierten ImageGen-Werkzeug generiert. Der genaue Prompt steht in `assets/motiv-prompt.txt`. Es zeigt eine fiktive Person.
- Website-Stil: `src/components/DartTeamOverview.astro`; dunkles Slate, rote Akzente, weiße Schrift und Ringmotive. Arial dient als lokale, druckfähige serifenlose Schrift.

`build_flyers.py` erzeugt mit ReportLab und Pillow die drei PDFs und drei SVGs. `render_and_check.py` rendert die PDFs mit Poppler, erstellt die Vergleichsansicht und prüft Maße, Textinhalt, Schrifteinbettung und eingebettete SVG-Ressourcen. Die Skripte benötigen den Codex-Python-Laufzeitpfad oder eine Python-Umgebung mit `reportlab`, `pypdf` und `Pillow` sowie `pdftoppm`.

Die Prüfungsergebnisse stehen in `preflight.json` und `verification.json`. Es wurden keine Website-Inhalte geändert.

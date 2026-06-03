# CONTRIBUTING UI (Public Site)

## Ziel

Einheitlicher Workflow fuer UI-Aenderungen, damit neue Features konsistent bleiben.

## Scope

Gilt fuer alle Public-UI-Dateien unter `src/pages`, `src/layouts`, `src/components` (ausser `src/components/admin`).

## Workflow fuer neue UI-Arbeit

1. Vorarbeit

- Relevante Muster in `COMPONENT-PATTERNS.md` pruefen.
- Tokens in `DESIGN-TOKENS.md` pruefen.
- Vorhandene Komponenten wiederverwenden, bevor neue erstellt werden.

1. Umsetzung

- Tokens first: keine neuen Hardcoded Werte, wenn Token existiert.
- Interaktionszustaende vollstaendig umsetzen.
- A11y-Regeln aus `ACCESSIBILITY.md` einhalten.

1. Dokumentation

- Falls neue Pattern-Familie entsteht: `COMPONENT-PATTERNS.md` aktualisieren.
- Falls neuer Designwert noetig ist: `DESIGN-TOKENS.md` und ggf. `themes.css` erweitern.

1. Verifikation

- `npm run build`
- `npm run test:a11y`
- `npm run test:visual`
- Manuelle Kontrolle auf mobilen und Desktop-Viewporten.

## PR-Checklist

1. Keine unnoetigen neuen Hardcoded Hex-Werte.
1. Focus-Verhalten sichtbar und konsistent.
1. Responsive Verhalten getestet.
1. Dokumentation aktualisiert.
1. Keine Admin-Styles unbeabsichtigt beeinflusst.

## AI-Assist Regeln

Bei AI-generiertem UI-Code gilt zusaetzlich:

1. AI muss bestehende Pattern wiederverwenden.
1. AI darf keine neue Designsprache pro Feature einfuehren.
1. AI-Antworten sollen bei UI-Entscheidungen auf die vier Design-System-Dokumente referenzieren.

## Ausnahmen

Ausnahmen sind erlaubt, wenn:

1. technisch durch externe APIs erzwungen,
1. der Sonderfall im PR klar beschrieben ist,
1. die Abweichung spaeter tokenisiert werden kann.

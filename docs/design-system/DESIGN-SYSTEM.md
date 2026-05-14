# DESIGN SYSTEM (Public Site)

## Scope

Dieses Design-System gilt fuer die oeffentliche Website.
Nicht im Scope: Admin UI unter `src/components/admin` und `public/admin`.

## Ziele

1. Einheitlicher Look and Feel fuer bestehende und neue Features.
1. Zentrale Design-Tokens als einzige Wertquelle.
1. Reproduzierbare Regeln fuer Mensch und AI.
1. A11y- und Visual-Qualitaet als feste Release-Gates.

## Prinzipien

1. Tokens first: Designwerte kommen aus zentralen Tokens.
1. Semantik vor Rohwert: Komponenten nutzen semantische Rollen.
1. Konsistenz vor Geschwindigkeit: lieber bestehendes Pattern erweitern.
1. A11y standardmaessig: Focus, Kontrast, Keyboard immer mitdenken.
1. Theme-Layer statt Fork: Sommer/Winter auf denselben Token-Namen.

## Layout-Regeln

1. Container: `container mx-auto px-4` als Standard.
1. Grid: mobile-first; asymmetrische Layouts erst ab `md`.
1. Breakpoints:

   - `sm` 640px
   - `md` 768px
   - `lg` 1024px
   - `xl` 1280px

1. Keine unkontrollierten Einmal-Breakpoints ohne Dokumentation.

## Typografie-Regeln

1. Sans-Stack aus Token `--font-family-sans`.
1. Text-Hierarchie in Komponenten konsistent halten (Eyebrow, Heading, Body, Meta).
1. Keine ad hoc Font-Sizes, wenn bestehende Scale reicht.

## Farb- und Interaktionsregeln

1. Primaere Aktion: `--color-interactive-primary` + hover Token.
1. Sekundaere Flaechen auf Surface/Text Tokens aufbauen.
1. Focus sichtbar und konsistent ueber Focus-Tokens.
1. Erfolgs-/Hinweisflaechen ueber Success-Tokens.

## Bewegungsregeln

1. Standarddauer aus Motion-Tokens.
1. Reduced-Motion respektieren.
1. Keine langen, unruhigen Bewegungen in Kerninteraktionen.

## Accessibility-Regeln

1. Vorhandene A11y-Dokumente sind verbindlich:

   - `ACCESSIBILITY.md`
   - `A11Y_SUMMARY.md`

1. Focus-Indikatoren bleiben klar sichtbar.
1. Keyboard-Flows fuer Menues/Dialoge immer pruefen.

## Golden Templates

Priorisierte Referenzen fuer neue Features:

1. `src/components/EventCardCompact.astro`
1. `src/components/Header.astro`
1. `src/components/HeaderLink.astro`
1. `src/components/Footer.astro`
1. `src/components/BadgeMini.astro`

## Theme-System

1. `data-theme="summer"` ist default.
1. `data-theme="winter"` liefert saisonale Variationen.
1. Theme-Wechsel veraendert keine Struktur, nur tokenisierte Werte.

## Release-Gates

1. `npm run build`
1. `npm run test:a11y`
1. `npm run test:visual`
1. Manuelle Smoke-Pruefung auf Start, Veranstaltungen, Sportheim, Event-Detail.

# GitHub Copilot Instructions für Astro SCO Projekt

## Projektübersicht
Dies ist eine Astro-basierte Website für den **SCO-OGV Oberfüllbach 1963 e.V.** (Sportverein) mit DecapCMS als Git-basiertes Content Management System. Die Website wird auf Vercel deployt und verwendet Tailwind CSS für das Styling.

## Technologie-Stack
- **Framework**: Astro 4.11.3 mit TypeScript
- **CMS**: DecapCMS (Git-basiert) für Content-Management
- **Styling**: Tailwind CSS mit Typography Plugin
- **Deployment**: Vercel (primär) / Netlify (alternativ)
- **Sprache**: Deutsch (de-DE)

## Projektstruktur & Architektur

### Content Collections (src/content/)
Das Projekt nutzt Astro Content Collections für strukturierte Inhalte:

- **`veranstaltungen/`**: Zukünftige Events mit Schema (title, eventDate, location, heroImage, cta, featured)
- **`berichte/`**: Vergangene Events/Berichte mit ähnlichem Schema
- **`start/`**: Homepage-Inhalte mit Reihenfolge (order-Feld)
- **`mitglieder/`**: Vereinsmitglieder mit Positionen und Bildern
- **`sportheim/`**: Sportheim-spezifische Inhalte
- **`settings/`**: JSON-basierte Site-Einstellungen

### Komponenten-Architektur (src/components/)
- **`App.astro`**: Main Layout mit Header, Footer, Navigation
- **`HpStage.astro`**: Hero-Bereich mit optimierten Hintergrundbildern
- **`EventsSection.astro`**: Wiederverwendbare Event-Listing-Komponente
- **`HpCard.astro`**: Card-Layout für Sidebar-Bereiche
- **`EventBanner.astro`**: Featured Event Darstellung
- **`BadgeMini.astro`**: Kleine Badge-Komponenten für Daten/Infos
- **`FormattedDate.astro`**: Deutsche Datumsformatierung

### Layouts (src/layouts/)
- **`App.astro`**: Hauptlayout mit Grid-System und responsive Navigation
- **`EventPost.astro`**: Template für Event-Detailseiten

### Seiten-Routing (src/pages/)
- **`index.astro`**: Homepage mit Event-Übersicht und Sidebar-Bereiche
- **`veranstaltungen/`**: Event-Listing und dynamische Event-Seiten `[...slug].astro`
- **`berichte/`**: Bericht-Listing und dynamische Bericht-Seiten `[...slug].astro`
- **`sportheim/`**: Sportheim-Infoseite
- **`mitglieder/`**: Mitglieder-Übersicht (aktuell nicht in Navigation)

## DecapCMS Integration

### CMS-Konfiguration (public/admin/config.yml)
Das CMS ist für deutsche Benutzer konfiguriert mit folgenden Collections:

- **Backend**: Git Gateway für Netlify
- **Media**: Speicherung in `public/assets/`
- **Slug-Format**: ASCII mit Unterstrichen
- **Sprache**: Deutsch

### Content-Typen im CMS:
1. **Startseite**: Für Homepage-Inhalte
2. **Veranstaltungen**: Events mit Datum, Ort, Bild, CTA
3. **Berichte**: Nachberichte zu Events
4. **Mitglieder**: Mit Rollen, Stammtisch-Status, Fotos
5. **Site Settings**: Globale Einstellungen (JSON)

### CMS-Zugang
- **Admin-Panel**: `/admin/` (Netlify Identity Widget)
- **CSS**: `public/admin/admin.css` (generiert via Tailwind)

## Entwicklungsrichtlinien

### Code-Stil & Konventionen
- **Sprache**: Deutsche Kommentare und Variablennamen wo angebracht
- **CSS**: Tailwind-first, Komponenten-scoped Styles nur wenn nötig
- **TypeScript**: Strict typing für Content Collections
- **Imports**: Relative imports, Astro-Components mit `.astro` Extension

### Responsive Design
- **Grid-Layout**: CSS Grid für main/sidebar Layout
- **Breakpoints**: mobile-first, md (768px), lg (1280px)
- **Images**: Astro Image Optimization mit multiple widths

### Performance-Optimierungen
- **Images**: `import.meta.glob` für dynamische Imports aus `/public/assets/`
- **Static Generation**: Alle Seiten statisch generiert
- **Preloading**: Logo und kritische Assets
- **Background Images**: Optimierte WebP mit Blur-Placeholders

### Content-Management
- **Dates**: Deutsche Formatierung (weekday, dd.mm.yyyy)
- **Events**: Automatische Sortierung nach Datum
- **Featured Events**: `featured: true` oder CTA-basierte Priorisierung
- **Kurze Events**: JSON-Datei für schnelle Termine ohne Full-Content

### Deployment-Spezifika
- **Vercel**: Standard-Deployment mit Analytics/SpeedInsights
- **Netlify**: Alternative via `DEPLOY_TARGET=netlify`
- **Environment**: Build-Target detection für Adapter-Switching

## Häufige Entwicklungsaufgaben

### Neue Event-Seite erstellen
```markdown
---
title: "Event Titel"
pubDate: 2025-01-01T10:00:00.000Z
eventDate: 2025-01-15T18:30:00.000Z
location: "Sportheim"
heroImage: "/assets/event-bild.jpg"
description: "Kurze Beschreibung"
cta: "Jetzt anmelden"
featured: true
---

Event-Inhalt in Markdown...
```

### Neue Komponente entwickeln
- Props-Interface definieren
- Responsive Design berücksichtigen
- Accessibility (deutsche Labels)
- Tailwind-basiertes Styling

### CMS-Collection erweitern
1. Schema in `src/content/config.ts` anpassen
2. CMS-Config in `public/admin/config.yml` erweitern
3. Entsprechende Page/Component erstellen

### Performance-Checks
- Lighthouse-Scores beachten
- Image-Optimierung prüfen
- Core Web Vitals überwachen (Vercel)

## Besonderheiten & Constraints

### Deutsche Lokalisierung
- Alle UI-Texte auf Deutsch
- Datumsformate: dd.mm.yyyy mit Wochentag
- Event-Stati: "Vergangene Veranstaltungen" vs "Kommende Termine"

### Vereins-spezifische Features
- Stammtisch vs. allgemeine Mitglieder
- Vorstandspositionen (1./2. Vorsitzender, Kassenwart, etc.)
- Regeltermine (Dart, Stammtisch)
- Sportheim-Öffnungszeiten

### Content-Workflow
- DecapCMS für non-technical Users
- Git-basiert für Entwickler-Zugang
- Automatische Slug-Generierung
- Media-Upload direkt ins Repository

### SEO & Meta
- Strukturierte Meta-Tags
- OpenGraph/Twitter Cards
- Canonical URLs
- Sitemap-Generierung

Beachte diese Richtlinien beim Vorschlagen von Code-Änderungen und neuen Features. Priorisiere Einfachheit und Wartbarkeit für die Vereinsmitglieder, die das CMS nutzen werden.

# GitHub Copilot Instructions für Astro SCO Projekt

## Projektübersicht

Dies ist eine Astro-basierte Website für den **SCO-OGV Oberfüllbach 1963 e.V.** (Sportverein) mit Directus als Content Management System.

## Technologie-Stack

- **Framework**: Astro 4.11.3 mit TypeScript
- **CMS**: Directus für redaktionelle Inhalte und globale Einstellungen
- **Styling**: Tailwind CSS mit Typography Plugin
- **Deployment**: Vercel (primär) / Netlify (alternativ)
- **Sprache**: Deutsch (de-DE)

## Kritische Entwicklungsrichtlinien

### Accessibility (a11y) Standards

🌐 **VERPFLICHTEND**: Alle Komponenten müssen den WCAG 2.1 AA Standards entsprechen:

#### Semantisches HTML

- **Landmark-Rollen**: `<header role="banner">`, `<nav role="navigation">`, `<main role="main">`, `<footer role="contentinfo">`
- **Heading-Hierarchie**: Logische Struktur h1 → h2 → h3, niemals Ebenen überspringen
- **Listen**: `<ul>`, `<ol>` für Navigation und Gruppierungen
- **Formulare**: `<label>` für alle Eingabefelder, `<fieldset>` für Gruppierungen

#### ARIA-Attribute

- **aria-label**: Beschreibende Labels für Buttons ohne Text
- **aria-labelledby**: Referenz zu beschreibenden Elementen
- **aria-describedby**: Zusätzliche Beschreibungen
- **aria-expanded**: Für ausklappbare Menüs (true/false)
- **aria-current**: Für aktuelle Seite ("page") oder Schritt
- **aria-hidden**: Für dekorative Elemente (true)
- **aria-live**: Für dynamische Inhalte ("polite"/"assertive")

#### Keyboard Navigation

- **Tab-Reihenfolge**: Logische Sequenz durch tabindex oder DOM-Reihenfolge
- **Focus Management**: Sichtbare Focus-Indikatoren (2px solid #dc2626)
- **Skip Links**: Zum Hauptinhalt, Navigation, Footer
- **Escape-Key**: Schließt Dialoge und Menüs
- **Enter/Space**: Aktiviert Buttons und Links

#### Touch & Mobile

- **Mindestgröße**: 44px × 44px für Touch-Targets
- **Abstände**: Mindestens 8px zwischen klickbaren Elementen
- **Responsive**: Funktioniert ab 320px Breite

#### Farbkontrast

- **Normaler Text**: Mindestens 4.5:1 Kontrastverhältnis
- **Großer Text**: Mindestens 3:1 (ab 18pt oder 14pt bold)
- **UI-Komponenten**: Mindestens 3:1 für Buttons, Icons
- **High Contrast Mode**: Unterstützung für Windows High Contrast

#### Bilder & Medien

- **Alt-Texte**: Beschreibend für informative Bilder, leer für dekorative
- **Loading**: `loading="lazy"` für Below-the-fold Bilder
- **Responsive**: Verschiedene Größen für verschiedene Viewports

#### Testing

```bash
# Accessibility Tests ausführen
npm run test:a11y              # Vollständige Tests
npm run test:a11y:headed       # Mit Browser-UI
npm run test:a11y:ui           # Interaktiver Modus
```

#### Code-Beispiele

```astro
<!-- Korrekte Button-Implementierung -->
<button
  type="button"
  aria-expanded="false"
  aria-controls="menu-id"
  class="focus:outline-none focus:ring-2 focus:ring-red-700"
>
  <span class="sr-only">Menü öffnen</span>
  <svg aria-hidden="true">...</svg>
</button>

<!-- Korrekte Navigation -->
<nav role="navigation" aria-label="Hauptnavigation">
  <ul role="list">
    <li role="none">
      <a href="/" aria-current="page">Startseite</a>
    </li>
  </ul>
</nav>

<!-- Korrekte Heading-Struktur -->
<main>
  <h1>Seitentitel</h1>
  <section>
    <h2>Bereichstitel</h2>
    <h3>Untertitel</h3>
  </section>
</main>
```

### Directus-Konsistenz

⚠️ **WICHTIG**: Redaktionelle Inhalte werden in Directus gepflegt. Schema, Relationen und Editor-Metadaten liegen in `scripts/directus/schema.mjs`; der Read-Path und die normalisierten Typen liegen in `src/lib/content-source.ts`.

- Schemaänderungen zuerst im Provisioning-Skript definieren und mit `npm run directus:provision:sync` anwenden.
- Lokale Markdown-Dateien sind nur Migrationsquellen und nicht der laufende Redaktionsweg.
- Bilder über Directus Files und die vorgesehenen Datei-Relationen verwalten.

### Deployment-Konfiguration

```typescript
// Dual-Deployment Setup
const deployTarget = process.env.DEPLOY_TARGET;
// "netlify" → undefined adapter
// default → vercel adapter mit Analytics
```

### Häufige Aufgaben

#### Neue Content Collection hinzufügen

1. Collection und Felder in `scripts/directus/schema.mjs` definieren
2. Read-Path und Typen in `src/lib/content-source.ts` ergänzen
3. Schema mit `npm run directus:provision:sync` synchronisieren
4. Build und betroffene Seiten gegen Directus testen

#### Neue Felder hinzufügen

1. Feld und Editor-Metadaten in `scripts/directus/schema.mjs` ergänzen
2. Mapping und Typen in `src/lib/content-source.ts` aktualisieren
3. Provisioning synchronisieren und den Directus-Read-Path testen

#### Media Handling

- Redaktionelle Bilder in Directus Files hochladen
- Für Titelbilder die jeweilige `hero_image_file`-Relation verwenden
- Repository-Assets nur für codegebundene, nicht redaktionelle Medien nutzen

### Performance & SEO

- Statische Site Generation (SSG)
- Responsive Images mit optimierten Formaten
- Deutsche Meta-Tags und Structured Data
- Sitemap-Generation aktiviert

### Debugging

- Directus-Konfiguration und Tokens über die dokumentierten Umgebungsvariablen prüfen
- Content Validation: Astro Dev Server zeigt Mapping- und Schema-Fehler
- Build-Zeit: Directus muss für den statischen Build erreichbar sein
- **Media**: Directus Files für redaktionelle Medien
- **Slug-Format**: ASCII mit Unterstrichen
- **Sprache**: Deutsch

### Content-Typen im CMS:

1. **Startseite**: Für Homepage-Inhalte
2. **Veranstaltungen**: Events mit Datum, Ort, Bild, CTA
3. **Berichte**: Nachberichte zu Events
4. **Mitglieder**: Mit Rollen, Stammtisch-Status, Fotos
5. **Site Settings**: Globale Einstellungen (JSON)

### CMS-Zugang

- Directus-URL und Zugangsdaten werden über die jeweilige Umgebung bereitgestellt.
- Migration und Provisioning sind in `docs/directus-migration.md` dokumentiert.

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

### Neuen Inhalt pflegen

Neue Veranstaltungen, Berichte und andere redaktionelle Inhalte direkt in Directus anlegen. Keine neuen Markdown-Beiträge im Repository erstellen.

### Neue Komponente entwickeln

- Props-Interface definieren
- Responsive Design berücksichtigen
- Accessibility (deutsche Labels)
- Tailwind-basiertes Styling

### CMS-Collection erweitern

1. Directus-Schema in `scripts/directus/schema.mjs` anpassen
2. Mapping in `src/lib/content-source.ts` ergänzen
3. Provisioning synchronisieren und Page/Component testen

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

- Directus für redaktionelle Pflege
- Git nur für Code und technische Konfiguration
- Medien-Upload über Directus Files
- Statischer Neubuild nach veröffentlichten CMS-Änderungen

### SEO & Meta

- Strukturierte Meta-Tags
- OpenGraph/Twitter Cards
- Canonical URLs
- Sitemap-Generierung

Beachte diese Richtlinien beim Vorschlagen von Code-Änderungen und neuen Features. Priorisiere Einfachheit und Wartbarkeit für die Vereinsmitglieder, die das CMS nutzen werden.

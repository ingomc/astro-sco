# GitHub Copilot Instructions für Astro SCO Projekt

## Projektübersicht
Dies ist eine Astro-basierte Website für den **SCO-OGV Oberfüllbach 1963 e.V.** (Sportverein) mit DecapCMS als Git-basiertes Content Management System.

## Technologie-Stack
- **Framework**: Astro 4.11.3 mit TypeScript
- **CMS**: DecapCMS 3.0+ (Git-basiert) für Content-Management
- **Styling**: Tailwind CSS mit Typography Plugin
- **Deployment**: Vercel (primär) / Netlify (alternativ)
- **Sprache**: Deutsch (de-DE)

## Kritische Entwicklungsrichtlinien

### Content Collections Konsistenz
⚠️ **WICHTIG**: Alle DecapCMS Collections in `/public/admin/config.yml` müssen exakt mit den Astro Content Schemas in `/src/content/config.ts` übereinstimmen!

### Bekannte gelöste Probleme
1. ✅ **Fehlende sportheim Collection** in DecapCMS wurde hinzugefügt
2. ✅ **Fehlende Felder** (`dart`, `email`, `description`) wurden ergänzt
3. ✅ **YAML-Syntax-Fehler** (fehlende Anführungszeichen) wurden korrigiert
4. ✅ **Media Folder Pfade** korrigiert (`/public/` → `public/`)

### Content Collections Schema-Mapping

#### veranstaltungen/ (Events)
```typescript
// DecapCMS → Astro Schema
title: string          // ✅ "Titel"
pubDate: Date          // ✅ "Erstellungsdatum" 
eventDate: Date        // ✅ "Veranstaltungsdatum"
location?: string      // ✅ "Veranstaltungsort" (optional)
heroImage?: string     // ✅ "Titelbild" (optional)
cta?: string          // ✅ "Button-Beschriftung" (optional)
description?: string   // ❌ FEHLT in DecapCMS - sollte hinzugefügt werden
featured?: boolean     // ❌ FEHLT in DecapCMS - sollte hinzugefügt werden
```

#### berichte/ (Reports)
```typescript
// DecapCMS → Astro Schema  
title: string          // ✅ "Titel"
description?: string   // ✅ "Beschreibung" (neu hinzugefügt)
pubDate: Date          // ✅ "Erstellungsdatum"
eventDate: Date        // ✅ "Veranstaltungsdatum"
location?: string      // ✅ "Veranstaltungsort" (optional)
heroImage?: string     // ✅ "Titelbild" (optional)
```

#### mitglieder/ (Members)
```typescript
// DecapCMS → Astro Schema
name: string           // ✅ "Name"
position?: string      // ✅ "Rolle" (select widget)
stammtisch?: boolean   // ✅ "Stammtisch" (boolean)
dart?: boolean         // ✅ "Dart" (neu hinzugefügt)
email?: string         // ✅ "Email" (neu hinzugefügt)
authorimage?: string   // ✅ "Image" (optional)
```

#### start/ (Homepage)
```typescript
// DecapCMS → Astro Schema
title: string          // ✅ "Title"
order: number          // ✅ "Reihenfolge"
```

#### sportheim/ (Club House)
```typescript
// DecapCMS → Astro Schema (neu hinzugefügt)
title: string          // ✅ "Title"
order?: number         // ✅ "Reihenfolge" (optional)
```

### DecapCMS Best Practices
1. **YAML-Syntax**: Alle Labels in Anführungszeichen setzen
2. **Media Paths**: `media_folder: "public/assets/"` (ohne führenden /)
3. **Slug Templates**: `"{{year}}-{{month}}-{{day}}-{{slug}}"` für Events/Berichte
4. **Required Fields**: Sparsam verwenden, nur essenzielle Felder
5. **Widget Types**: 
   - `datetime` für alle Datum/Zeit-Felder
   - `boolean` mit `default: false`
   - `select` für Rollen mit vordefinierten Optionen

### Deployment-Konfiguration
```typescript
// Dual-Deployment Setup
const deployTarget = process.env.DEPLOY_TARGET;
// "netlify" → undefined adapter
// default → vercel adapter mit Analytics
```

### Häufige Aufgaben

#### Neue Content Collection hinzufügen
1. Schema in `/src/content/config.ts` definieren
2. Collection in `/public/admin/config.yml` hinzufügen
3. Export im collections object ergänzen
4. ⚠️ **Beide Dateien MÜSSEN synchron bleiben!**

#### Neue Felder hinzufügen
1. Zuerst in Astro Schema (`config.ts`) definieren
2. Dann in DecapCMS (`config.yml`) hinzufügen
3. Testen mit DecapCMS Admin Interface

#### Media Handling
- Upload-Ordner: `/public/assets/`
- Referenz in Content: `/assets/filename.jpg`
- Spezielle Ordner: `/assets/mitglieder/` für Member-Bilder

### Performance & SEO
- Statische Site Generation (SSG)
- Responsive Images mit optimierten Formaten
- Deutsche Meta-Tags und Structured Data
- Sitemap-Generation aktiviert

### Debugging
- DecapCMS Admin: `/admin/` URL
- Content Validation: Astro Dev Server zeigt Schema-Fehler
- Build-Zeit: TypeScript-Checks für Content-Schema-Inkonsistenzen
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

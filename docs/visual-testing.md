# Visual Regression Testing für UI-Komponenten

Dieses Setup schützt kritische UI-Komponenten vor ungewollten optischen Änderungen.

## Setup

```bash
# Playwright installieren
npm install -D @playwright/test

# Browser installieren
npx playwright install
```

## Tests ausführen

```bash
# Erstmalig - Baseline Screenshots erstellen
npm run test:visual:update

# Tests ausführen
npm run test:visual

# Tests mit UI (interaktiv)
npm run test:visual:ui

# Tests mit sichtbarem Browser
npm run test:visual:headed

# Test Report anzeigen
npm run test:visual:report
```

## Was wird getestet

### Mobile Side-Drawer
- ✅ Geöffneter Side-Drawer mit weißen Buttons
- ✅ Korrekte Navigation Links
- ✅ Button-Styles bleiben unverändert

### Desktop Header
- ✅ Kompletter Header-Bereich
- ✅ Navigation im normalen Zustand
- ✅ Logo und Layout

## Konfiguration

### Multi-Browser Testing
Tests laufen automatisch in:
- Desktop Chrome, Firefox, Safari
- Mobile Chrome, Safari

### Geschützte Dateien
Diese Dateien sind durch die Tests abgedeckt:
- `src/components/Header.astro`
- `src/components/HeaderLink.astro`

## Troubleshooting

### Test schlägt fehl
```bash
# Neue Baseline erstellen (nur wenn Änderung gewollt!)
npm run test:visual:update

# Unterschiede anzeigen
npm run test:visual:report
```

### Threshold anpassen
In `playwright.visual.config.ts` den `threshold` Wert ändern:
```typescript
threshold: 0.2, // 20% Unterschied erlaubt
```

## Best Practices

1. **Baseline Updates**: Nur nach bewussten Design-Änderungen
2. **Lokale Tests**: Vor wichtigen Änderungen lokal testen
3. **Animation Handling**: Automatisch deaktiviert für konsistente Screenshots
4. **Minimal Testing**: Nur kritische Komponenten, nicht die ganze Seite

Das verhindert, dass jemand (auch AI 😉) versehentlich die kritischen UI-Komponenten kaputt macht!

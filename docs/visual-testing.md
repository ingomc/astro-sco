# Visual Regression Testing für UI-Komponenten

Dieses Setup schützt kritische UI-Komponenten wie Header und Side-Drawer vor ungewollten optischen Änderungen.

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
```

## Was wird getestet

### Desktop Header
- ✅ Navigation im normalen Zustand
- ✅ Active States (z.B. auf Sportheim-Seite)
- ✅ Hover States
- ✅ Focus States (Tastaturnavigation)

### Mobile Side-Drawer
- ✅ Geschlossener Zustand
- ✅ Geöffneter Side-Drawer mit Backdrop
- ✅ Button-Styles (weiße Buttons wie gewünscht!)
- ✅ Focus Management

### Skip Links
- ✅ Sichtbarkeit bei Focus
- ✅ Korrekte Positionierung

## Automatisierung

### CI/CD Integration
- Tests laufen automatisch bei Pull Requests
- Nur wenn Header/Navigation-Dateien geändert werden
- Fail bei optischen Regressionen

### Protected Components
Diese Komponenten sind durch Visual Tests geschützt:
- `Header.astro`
- `HeaderLink.astro` 
- `SkipLinks.astro`
- `App.astro`
- Navigation-relevante Styles

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
2. **Browser Testing**: Tests laufen in Chrome, Firefox, Safari
3. **Mobile Testing**: Separate Tests für responsive Breakpoints
4. **Animation Handling**: Automatisch deaktiviert für konsistente Screenshots

Das verhindert, dass jemand (auch AI 😉) versehentlich deine Side-Drawer Buttons wieder kaputt macht!

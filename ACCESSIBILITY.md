# Accessibility Checklist für SCO-Website

## Vor jedem Commit prüfen:

### ✅ Semantisches HTML
- [ ] Korrekte Landmark-Rollen verwendet (`<header>`, `<nav>`, `<main>`, `<footer>`)
- [ ] Logische Heading-Hierarchie (h1 → h2 → h3, keine Ebenen überspringen)
- [ ] Listen für Navigation und Gruppierungen verwendet
- [ ] Korrekte Form-Labels für alle Eingabefelder

### ✅ ARIA-Attribute
- [ ] `aria-label` für Buttons ohne sichtbaren Text
- [ ] `aria-expanded` für ausklappbare Menüs
- [ ] `aria-current="page"` für aktuelle Seite
- [ ] `aria-hidden="true"` für dekorative Icons
- [ ] `aria-live` für dynamische Inhalte

### ✅ Keyboard Navigation
- [ ] Alle interaktiven Elemente mit Tab erreichbar
- [ ] Sichtbare Focus-Indikatoren (2px red ring)
- [ ] Skip Links funktionieren
- [ ] Escape schließt Dialoge
- [ ] Enter/Space aktiviert Buttons

### ✅ Farbkontrast
- [ ] Mindestens 4.5:1 für normalen Text
- [ ] Mindestens 3:1 für große Texte (18pt+)
- [ ] Mindestens 3:1 für UI-Komponenten
- [ ] Information nicht nur durch Farbe vermittelt

### ✅ Bilder
- [ ] Alle Bilder haben beschreibende alt-Texte
- [ ] Dekorative Bilder haben leere alt-Attribute
- [ ] `loading="lazy"` für Below-the-fold Bilder
- [ ] Angemessene Bildgrößen für Performance

### ✅ Mobile & Touch
- [ ] Touch-Targets mindestens 44px × 44px
- [ ] Mindestens 8px Abstand zwischen klickbaren Elementen
- [ ] Funktioniert ab 320px Breite
- [ ] Horizontal scrollbar vermieden

### ✅ Testing
- [ ] Axe DevTools Chrome Extension verwendet
- [ ] `npm run test:a11y` erfolgreich
- [ ] Mit Tastatur durch die gesamte Seite navigiert
- [ ] Screen Reader getestet (NVDA/JAWS/VoiceOver)

### ✅ Performance
- [ ] Lighthouse Accessibility Score ≥ 95
- [ ] Keine Console-Warnungen bezüglich a11y
- [ ] Fast loading für alle Nutzer

## Tools & Extensions

### Browser Extensions
- **axe DevTools**: Chrome/Firefox Extension für automatische Tests
- **WAVE**: Web Accessibility Evaluation Tool
- **Lighthouse**: Integriert in Chrome DevTools

### Screen Reader Testing
- **Windows**: NVDA (kostenlos) oder JAWS
- **macOS**: VoiceOver (integriert)
- **Mobile**: TalkBack (Android) oder VoiceOver (iOS)

### Kommandozeile
```bash
npm run test:a11y              # Vollständige Accessibility-Tests
npm run test:a11y:headed       # Tests mit Browser-Oberfläche
npm run test:a11y:ui           # Interaktiver Test-Modus
```

## Häufige Probleme vermeiden

### ❌ Nicht machen:
- Links ohne href oder mit `href="#"`
- Buttons ohne type-Attribut
- Icons ohne aria-hidden oder alt-Text
- onClick-Handler auf nicht-interaktiven Elementen
- Zu niedrige Farbkontraste
- Autoplay von Videos mit Sound

### ✅ Stattdessen:
- Semantisch korrekte HTML-Elemente verwenden
- ARIA-Attribute sparsam und korrekt einsetzen
- Keyboard-Navigation testen
- Screen Reader testen
- Automatische Tests in CI/CD einbauen

## Ressourcen

- [WCAG 2.1 Richtlinien](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN Accessibility Docs](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)

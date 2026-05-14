# DESIGN TOKENS

## Ziel
Dieses Dokument definiert die zentrale Token-Quelle fuer die oeffentliche Website.
Neue UI-Entwicklung nutzt Tokens statt verstreuter Einzelwerte.

## Source of Truth
1. `src/styles/tokens.css` (primitive + semantische Tokens)
2. `src/styles/themes.css` (Sommer/Winter Theme-Layer)
3. `tailwind.config.cjs` (Tailwind Mapping auf CSS Variablen)

## Token-Schichten
1. Primitive Tokens: rohe Werte, z. B. `--color-brand-700`, `--radius-lg`.
2. Semantische Tokens: Rollen, z. B. `--color-text-primary`, `--color-border-default`.
3. Komponentennahe Tokens: abgeleitete Nutzung in `.ds-*` Klassen und Komponentenmuster.

## Farbtokens
- Brand:
  - `--color-brand-100`
  - `--color-brand-600`
  - `--color-brand-700`
  - `--color-brand-800`
- Surface:
  - `--color-surface-page`
  - `--color-surface-muted`
  - `--color-surface-raised`
- Text:
  - `--color-text-primary`
  - `--color-text-secondary`
  - `--color-text-muted`
- Border:
  - `--color-border-default`
  - `--color-border-strong`
- Interaktiv:
  - `--color-interactive-primary`
  - `--color-interactive-primary-hover`
  - `--color-interactive-on-primary`
- Focus:
  - `--color-focus-ring`
  - `--color-focus-offset`
  - `--focus-ring-width`
  - `--focus-ring-offset`
- Erfolg:
  - `--color-success-bg`
  - `--color-success-border`
  - `--color-success-text`

## Typografie und Spacing
- Font:
  - `--font-family-sans`
- Spacing:
  - `--spacing-1` bis `--spacing-12`
- Radius:
  - `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, `--radius-pill`
- Shadow:
  - `--shadow-sm`, `--shadow-md`, `--shadow-lg`
- Motion:
  - `--duration-fast`, `--duration-normal`, `--duration-slow`, `--ease-standard`
- Layer:
  - `--z-base`, `--z-content`, `--z-header`, `--z-overlay`, `--z-skiplink`
- Breakpoints (Dokumentation + CSS):
  - `--breakpoint-sm`, `--breakpoint-md`, `--breakpoint-lg`, `--breakpoint-xl`

## Theme-Layer
- Sommer (default): `:root` und `[data-theme="summer"]`
- Winter: `[data-theme="winter"]`
- Theme-Relevante Tokens:
  - `--hero-band-gradient`
  - `--image-stage-overlay`
  - Surface/Boder/Focus Offset Tokens

## Tailwind-Mapping
Tailwind-Klassen bleiben erlaubt und werden ueber `tailwind.config.cjs` an Token-Werte gebunden.
Neue, projektweite Utility-Familien nutzen bevorzugt semantische Keys wie:
- `brand.*`
- `surface.*`
- `text.*`
- `border.*`
- `success.*`

## Regeln
1. Keine neuen Hardcoded Hex-Werte im Public UI, wenn ein passender Token existiert.
2. Neue Designwerte immer zuerst als Token definieren.
3. Tokens nur in `tokens.css` und `themes.css` pflegen.
4. Visuelle Sonderfaelle dokumentieren, statt ad hoc im Component-Style zu verstecken.

## Erlaubte Ausnahmen
Hardcoded Werte sind nur erlaubt, wenn:
1. Ein externes Karten-/Canvas-API zwingend Farbe im JS erwartet.
2. Ein einmaliger, lokaler Spezialfall dokumentiert wurde.

## Erweiterungsprozess
1. Bedarf beschreiben (z. B. neue Warnfarbe).
2. Primitive + semantische Tokens definieren.
3. Theme-Auswirkungen pruefen (Sommer/Winter).
4. Tailwind-Mapping erweitern.
5. Dokumente aktualisieren (`DESIGN-SYSTEM.md`, `COMPONENT-PATTERNS.md`).
6. Tests laufen lassen: `npm run test:a11y` und `npm run test:visual`.

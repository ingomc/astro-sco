# COMPONENT PATTERNS

## Ziel

Dieses Dokument definiert wiederverwendbare Public-UI-Muster fuer neue Features (z. B. Bestellsystem).

## Pattern 1: Card Basis

Verwendung fuer Event-Teaser, Inhaltsboxen, Nebenbereiche.

Klassen:

- `ds-card`
- optional `ds-card-hover`

Regeln:

1. Border und Radius aus Tokens.
1. Hover-Schatten nur wenn Interaktivitaet vorhanden.
1. Focus-Ring bei klickbaren Cards nicht vergessen.

## Pattern 2: Primaere Aktion

Verwendung fuer zentrale CTAs.

Klassen:

- `ds-btn`
- `ds-btn-primary`
- `ds-focus-ring`

Regeln:

1. Primary nur fuer Hauptaktion einsetzen.
1. Disabled/Loading visuell klar absetzen.
1. Touch-Targets >= 44px.

## Pattern 3: Navigation Link

Referenz: `src/components/HeaderLink.astro`

Regeln:

1. Active State klar, aber im selben Designsystem.
1. Focus sichtbar.
1. Keine neue, inkompatible Link-Optik pro Seite erfinden.

## Pattern 4: Badge/Meta Label

Referenz: `src/components/BadgeMini.astro`

Regeln:

1. Kleine semantische Hinweise (Datum, Status, Labels).
1. Tokenisierte Hintergrund-/Textfarben.
1. Keine beliebige neue Badge-Familie ohne Bedarf.

## Pattern 5: Formularblock

Referenzen:

- `src/components/EventSignupForm.astro`
- `src/components/DartOpenPlaySignupForm.astro`

Regeln:

1. Label ueber Input.
1. Hilfetext/Fehlermeldung unter Input.
1. Fokus, Error und Success konsistent tokenisiert.
1. Felder und Buttons auf dieselbe Radius-/Spacing-Systematik.

## Pattern 6: Section Wrapper

Klasse:

- `ds-section-container`

Regeln:

1. Standardseiten auf identischen horizontalen Rastern.
1. Keine abweichenden Einmal-Container ohne Grund.

## Zustaende (Pflicht)

Jede interaktive Komponente muss folgende Zustaende beruecksichtigen:

1. default
1. hover
1. focus-visible
1. active (wenn relevant)
1. disabled
1. error (bei Formularen)
1. loading (bei async Aktionen)
1. empty (bei Listen ohne Daten)

## Bestellsystem-Leitplanke

Neue Bestellsystem-Komponenten muessen:

1. auf bestehenden Pattern-Familien aufbauen,
1. keine neuen Raw-Hex-Werte einfuehren,
1. Focus-/A11y-Verhalten der bestehenden Form-Komponenten uebernehmen,
1. visuell durch `test:visual` regressionssicher sein.

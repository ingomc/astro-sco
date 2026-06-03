// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = "SCO-OGV Oberfüllbach 1963 e.V.";
export const SITE_DESCRIPTION = "Der SCO-OGV Oberfüllbach 1963 e.V. ist ein offener und familiärer Verein, bei dem neben dem sportlichen Betätigung auch das gesellschaftliche Leben eine wichtige Rolle spielt.";
export const BRAND_THEME_COLOR = "#dc2626";

// ===========================================
// LOGO KONFIGURATION
// ===========================================
// Setze auf true für das Winter-Logo mit Schnee
// Setze auf false für das normale Logo
export const USE_WINTER_LOGO = false;

// Logo-Pfade (nicht ändern, außer die Dateien werden umbenannt)
export const LOGO_NORMAL = "/assets/logo_sco_min.png";
export const LOGO_WINTER = "/logos/logo_sco_winter.avif";

// ===========================================
// BUEHNENBILD KONFIGURATION
// ===========================================
// Setze auf true für das Winterbild
// Setze auf false für das Sommerbild
export const USE_WINTER_STAGE = false;

// Zentrales Theme-Flag fuer die oeffentliche Website.
export const SITE_THEME = USE_WINTER_LOGO || USE_WINTER_STAGE ? "winter" : "summer";

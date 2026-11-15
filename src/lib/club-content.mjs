/** Keep the club spelling consistent in code and migrated CMS text. */
export function normalizeClubName(text) {
  return text.replace(
    /\bSCO[^\S\r\n]*(?:[-/–—]|&(?:amp;|#0*38;|#x0*26;)?|und)[^\S\r\n]*OGV\b/gi,
    "SCO & OGV",
  );
}

/**
 * Correct the known legacy paragraphs while the updated copy is being reviewed.
 * Newly edited CMS paragraphs remain authoritative and do not match these rules.
 */
export function prepareClubBody(collection, slug, body) {
  let result = normalizeClubName(body);
  if (collection === "start" && slug === "heim") {
    result = result
      .replace(
        /^Treffen Sie uns jeden Mittwoch und Sonntag[^\r\n]+/m,
        "Unser offenes Steel-Darts-Training findet sonntags ab 18:00 Uhr im Sportheim statt. Alle sind willkommen, unabhängig von ihrer Spielerfahrung. [Mehr erfahren und kostenlos anmelden](/darts/training).",
      )
      .replace(
        /^Feiern Sie Ihre besonderen Anlässe im gemütlichen Ambiente[^\r\n]+/m,
        "Für private Feiern können Sie unser Sportheim anfragen. Alle Details und Termine klären die Vorstände mit Ihnen persönlich. [Mehr zu Feiern und Räumen](/sportheim/feiern).",
      );
  }
  if (collection === "sportheim" && slug === "inhalt") {
    result = result
      .replace(
        /^Jeden Dienstag und Sonntag spielen wir[^\r\n]+/m,
        "Unser offenes Steel-Darts-Training findet sonntags ab 18:00 Uhr statt. Alle sind willkommen. [Hier können Sie sich kostenlos anmelden](/darts/training).",
      )
      .replace(
        /^Das Sportheim kann für Ihre Feste gebucht werden\.\r?\nBitte wenden Sie sich für Details und Termine an die Vorstände\./m,
        "Private Feiern im Sportheim sind auf Anfrage möglich. [Informationen zu Feiern und Räumen](/sportheim/feiern).",
      );
  }
  return result;
}

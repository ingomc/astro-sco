import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeClubName,
  prepareClubBody,
} from "../src/lib/club-content.mjs";

test("normalizes legacy club spellings including HTML entities", () => {
  for (const name of [
    "SCO-OGV",
    "SCO/OGV",
    "SCO&OGV",
    "SCO&amp;OGV",
    "SCO &#38; OGV",
    "SCO und OGV",
  ]) {
    assert.equal(
      normalizeClubName(`${name} Oberfüllbach 1963 e.V.`),
      "SCO & OGV Oberfüllbach 1963 e.V.",
    );
  }
});

test("updates known migrated training copy while preserving sauna information", () => {
  const body =
    "## Steel-Darts im Sportheim\n\nJeden Dienstag und Sonntag spielen wir im Sportheim Steeldarts.\n\n## Sauna im Sportheim\n\nAb vier Personen kann die Sauna genutzt werden.";
  const updated = prepareClubBody("sportheim", "inhalt", body);
  assert.match(updated, /sonntags ab 18:00 Uhr/);
  assert.match(updated, /\/darts\/training/);
  assert.match(updated, /Ab vier Personen kann die Sauna genutzt werden\./);
  assert.equal(prepareClubBody("berichte", "historischer-bericht", body), body);
});

test("preserves newer CMS copy and unrelated links", () => {
  const body =
    "## Steel-Darts\n\nNeue Informationen direkt aus dem CMS. [Liga](/darts).";
  assert.equal(prepareClubBody("start", "heim", body), body);
});

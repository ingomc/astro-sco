# Projektkontext: Directus

- Das produktive CMS ist `https://cms.dart.ingomc.de/`. Es läuft als eigene
  Dokploy-Compose-Installation und wird nicht aus diesem Astro-Repository gebaut.
- Die native MCP-Schnittstelle ist `https://cms.dart.ingomc.de/mcp`. In der
  lokalen, nicht versionierten `.env` liegt der dafür bestätigte Zugang unter
  `MCP_TOKEN`. Den Wert weder ausgeben noch committen. Der separate
  `DIRECTUS_TOKEN` ist nicht automatisch für administrative Änderungen geeignet.
- Falls in einer Codex-Sitzung kein Directus-MCP-Tool angeboten wird, lässt sich
  die native Schnittstelle per MCP-JSON-RPC über HTTPS mit `MCP_TOKEN` nutzen.
  Vor Änderungen mit `schema` die betroffenen Sammlungen prüfen; `fields`
  verwaltet Felder und `items` die Inhalte. Danach über MCP zurücklesen.
  Details stehen in [docs/directus-migration.md](docs/directus-migration.md).
- Für diese Directus-Installation keinen SSH-Zugang verwenden. Die
  Dart-Erweiterung wird im Dokploy-Compose-Template über ein gemeinsames
  Extensions-Volume geladen; [docs/dart-open-play.md](docs/dart-open-play.md)
  beschreibt den Ablauf.

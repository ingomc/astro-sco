# Live-Ligaspiele lokal ansehen

`pnpm run dev:dart-demo` startet die Website auf http://127.0.0.1:4328.
Ein bereits laufender Server auf diesem Port muss vorher beendet werden.

- Liga mit LIVE-Markierung: http://127.0.0.1:4328/darts
- Einzelspiele auf zwei Boards: http://127.0.0.1:4328/darts/spiel?match=102
- Szenarien umschalten: http://127.0.0.1:4328/__dart-demo/

Standardmäßig laufen zwei Einzelpartien, deren Restpunkte sich alle drei Sekunden
ändern. Über das Szenario-Menü lassen sich fehlende Übertragung, Pause zwischen
Einzelspielen, Liga-Abschluss und Verbindungsabbruch mit Wiederverbindung ansehen.
Ein LIVE-Spiel bleibt zwischen Einzelpartien LIVE; erst der bestätigte
Liga-Abschluss beendet die Anzeige. Nur LIVE-Spiele haben einen Detail-Link.

Der lokale Vite-Plugin simuliert die 3K-REST-Antworten und die echte
SockJS/STOMP-Verbindung. Die Website verwendet dieselben Adapter und Komponenten
wie im normalen Betrieb. Keine echten Spieldaten werden verändert.

Die Demo nutzt lokale Astro-Inhalte statt des CMS. Die Trainingsanmeldung und
Essensvorbestellung sind nicht Teil der Simulation. Ohne den Demo-Befehl läuft die
Website mit ihren regulären Datenquellen. Die Demo-Endpunkte sind ausschließlich
im Dev-Server aktiv; Produktionsbuilds verwenden immer die echten 3K-Adressen.

Die Spielansicht zeigt zusätzlich letzten Wurf, 3-Dart-Average, Darts im Leg,
Anwurf und den Spieler am Wurf. High Finish und hohe Aufnahmen sind aufklappbar.
Die Demo simuliert abwechselnde Aufnahmen, Checkouts und Legwechsel; Statistiken
werden über dieselben REST- und STOMP-Felder wie im öffentlichen 3K-Feed übertragen.
Es werden nur verfügbare Statistikwerte angezeigt. Fehlende Werte bleiben leer;
Zeilen und Bereiche ohne Daten werden ausgeblendet. Sets und Einzelwürfe erscheinen
nur bei passender Übertragung.

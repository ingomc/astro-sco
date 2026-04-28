# Kirchweih 2025 - Google Apps Script Setup

Diese Datei erklärt, wie das Google Apps Script für automatische E-Mail-Benachrichtigungen eingerichtet wird.

## 1. Google Apps Script erstellen

1. Gehen Sie zu [script.google.com](https://script.google.com)
2. Klicken Sie auf "Neues Projekt"
3. Benennen Sie das Projekt: "Kirchweih 2025 E-Mail Automation"

## 2. Script-Code hinzufügen

Ersetzen Sie den Standard-Code durch folgenden Code:

```javascript
/**
 * Kirchweih 2025 - E-Mail Automation
 * Automatische Bestätigungs-E-Mails und Admin-Benachrichtigungen
 */

function onFormSubmit(e) {
  try {
    // Form-Antworten extrahieren
    const responses = e.values;
    const timestamp = responses[0];
    const email = responses[1];
    const name = responses[2];
    const phone = responses[3];
    const timeSlot = responses[4];
    const merchAmount = parseInt(responses[5]) || 0;
    const veggieAmount = parseInt(responses[6]) || 0;
    
    // Preise berechnen
    const merchPrice = merchAmount * 12.50;
    const veggiePrice = veggieAmount * 11.50;
    const totalPrice = merchPrice + veggiePrice;
    const totalPortions = merchAmount + veggieAmount;
    
    // Bestätigungs-E-Mail an Kunden senden
    sendConfirmationEmail(email, name, phone, timeSlot, merchAmount, veggieAmount, totalPrice);
    
    // Admin-Benachrichtigung senden
    sendAdminNotification(name, email, phone, timeSlot, merchAmount, veggieAmount, totalPrice, totalPortions);
    
  } catch (error) {
    console.error('Fehler bei E-Mail-Versand:', error);
    // Optional: Fehler-E-Mail an Admin senden
  }
}

function sendConfirmationEmail(email, name, phone, timeSlot, merchAmount, veggieAmount, totalPrice) {
  const subject = '🎪 Kirchweih 2025 - Anmeldung bestätigt';
  
  let menuDetails = '';
  if (merchAmount > 0) {
    menuDetails += `• Merch mit Klös: ${merchAmount}x (${(merchAmount * 12.50).toFixed(2)} €)\n`;
  }
  if (veggieAmount > 0) {
    menuDetails += `• Vegetarisch: ${veggieAmount}x (${(veggieAmount * 11.50).toFixed(2)} €)\n`;
  }
  
  const body = `Liebe/r ${name},

vielen Dank für Ihre Anmeldung zur Kirchweih 2025!

📋 Ihre Bestellung:
• Uhrzeit: ${timeSlot}
${menuDetails}• Gesamtpreis: ${totalPrice.toFixed(2)} €

📞 Ihre Kontaktdaten: ${phone}

ℹ️ Wichtige Hinweise:
• Bezahlung erfolgt vor Ort in bar
• Bei Änderungen oder Stornierungen kontaktieren Sie uns bitte
• Anmeldeschluss: 3 Tage vor der Veranstaltung

Wir freuen uns auf Sie!

Ihr SCO-OGV Oberfüllbach Team

---
SCO-OGV Oberfüllbach 1963 e.V.
Lützelbucher Str. 7
96237 Ebersdorf-Oberfüllbach
📧 info@sco-oberfuellbach.de
📞 09560 / 8609`;

  MailApp.sendEmail(email, subject, body);
}

function sendAdminNotification(name, email, phone, timeSlot, merchAmount, veggieAmount, totalPrice, totalPortions) {
  const adminEmail = 'info@sco-oberfuellbach.de'; // Admin E-Mail hier anpassen
  const subject = `Neue Kirchweih-Anmeldung: ${name}`;
  
  const body = `Neue Anmeldung für Kirchweih 2025:

👤 Kunde: ${name}
📧 E-Mail: ${email}
📞 Telefon: ${phone}
🕐 Uhrzeit: ${timeSlot}

🍽️ Bestellung:
• Merch mit Klös: ${merchAmount}x
• Vegetarisch: ${veggieAmount}x
• Gesamt: ${totalPortions} Personen
• Preis: ${totalPrice.toFixed(2)} €

---
Automatische Benachrichtigung vom Kirchweih-Anmeldesystem`;

  MailApp.sendEmail(adminEmail, subject, body);
}

/**
 * Kapazitäts-Check Funktion (optional)
 * Kann erweitert werden, um Zeitslots bei Erreichen der Kapazität zu deaktivieren
 */
function checkCapacity() {
  // Hier könnte eine Funktion implementiert werden, die:
  // 1. Alle Anmeldungen für jeden Zeitslot zählt
  // 2. Bei Erreichen von 15 Personen pro Slot eine Warnung sendet
  // 3. Das Formular entsprechend anpasst
}
```

## 3. Trigger einrichten

1. Klicken Sie auf das Uhr-Symbol (Trigger) in der Seitenleiste
2. Klicken Sie auf "+ Trigger hinzufügen"
3. Konfigurieren Sie:
   - **Funktion ausführen:** `onFormSubmit`
   - **Ereignisquelle:** `Aus Formular`
   - **Ereignistyp:** `Bei Formularübermittlung`
   - **Formular auswählen:** Ihr Kirchweih-Formular

## 4. Berechtigungen erteilen

1. Speichern Sie das Script (Strg+S)
2. Klicken Sie auf "Ausführen" um das Script zu testen
3. Erteilen Sie die erforderlichen Berechtigungen:
   - Gmail zum Senden von E-Mails
   - Google Forms zum Zugriff auf Formular-Daten

## 5. E-Mail-Templates anpassen

- **Admin-E-Mail:** Ändern Sie `adminEmail` in der Funktion `sendAdminNotification`
- **E-Mail-Texte:** Passen Sie die Nachrichten in den Funktionen nach Bedarf an
- **Preise:** Bei Preisänderungen müssen die Werte im Script aktualisiert werden

## 6. Testing

1. Füllen Sie das Formular testweise aus
2. Prüfen Sie, ob sowohl Bestätigungs- als auch Admin-E-Mail ankommen
3. Überprüfen Sie die Formatierung und Inhalte

## 7. Erweiterte Features (optional)

### Kapazitäts-Management:
- Script kann erweitert werden, um Anmeldungen pro Zeitslot zu zählen
- Automatische Deaktivierung voller Zeitslots
- Warnung bei fast ausgebuchten Slots

### Erinnerungs-E-Mails:
- Script für Erinnerung 1 Tag vor der Veranstaltung
- Zeitgesteuerte Trigger für automatische Erinnerungen

### Statistiken:
- Automatische Berichte über Anmeldezahlen
- Export der Daten für Küchen-Planung

## Troubleshooting

### Häufige Probleme:
1. **E-Mails kommen nicht an:** Prüfen Sie Spam-Ordner und Gmail-Berechtigungen
2. **Script-Fehler:** Überprüfen Sie die Spaltenzuordnung im Formular
3. **Trigger funktioniert nicht:** Stellen Sie sicher, dass der Trigger korrekt verknüpft ist

### Logs prüfen:
- Gehen Sie zu "Ausführungen" im Apps Script Dashboard
- Prüfen Sie die Logs bei Fehlern

---

**Wichtiger Hinweis:** Testen Sie das System gründlich, bevor es live geht!
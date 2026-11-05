# Pokémon-Entdeckertour

Eine kleine lokale Web-App für eine Pokémon-Schnitzeljagd. Sie läuft auf einem Computer als Spielstation; mehrere Trainerprofile können nacheinander dasselbe Gerät benutzen.

## Schnellstart unter Windows

1. **Node.js (LTS)** installieren: <https://nodejs.org/>
2. Dieses Repository herunterladen oder klonen.
3. Im Ordner `pokemon-entdeckertour` die Datei **`start-app.cmd`** doppelklicken.
4. Beim ersten Start lädt das Skript die nötigen Pakete herunter. Das kann einen Moment dauern.
5. Das schwarze Fenster geöffnet lassen. In Chrome oder Edge am Computer diese Adresse öffnen: **http://localhost:5173/**

Das Skript startet einen kleinen Entwicklungs-Webserver. `index.html` bitte nicht direkt doppelklicken: Die App benötigt den Webserver, damit TypeScript und die PWA-Dateien geladen werden können.

## Alternative: Start über PowerShell

Im Projektordner ein Terminal öffnen und diese Befehle ausführen:

```powershell
npm install
npm run dev
```

Danach **http://localhost:5173/** im Browser öffnen. Zum Beenden im Terminal `Ctrl+C` drücken.

## Auf dem Handy im selben WLAN ausprobieren

Das Handy und der Computer müssen mit demselben WLAN verbunden sein.

1. Den Webserver am Computer starten und das Terminalfenster offen lassen.
2. Unter Windows PowerShell oder Eingabeaufforderung `ipconfig` ausführen und die **IPv4-Adresse** der WLAN-Verbindung suchen, zum Beispiel `192.168.1.42`.
3. Auf dem Handy Chrome öffnen und `http://192.168.1.42:5173/` aufrufen. Dabei die Beispiel-IP durch die IPv4-Adresse des Computers ersetzen.
4. Falls Windows fragt, den Zugriff für Node.js im **privaten Netzwerk** erlauben.

Das reicht zum Ausprobieren im Browser. Für eine Installation als PWA auf dem Handy wird normalerweise eine HTTPS-Adresse benötigt; HTTP über die lokale WLAN-IP ist dafür nicht ausreichend.

## Was man ausprobieren kann

- Neue Trainerprofile anlegen und zwischen ihnen wechseln.
- Starter auswählen, Kämpfe spielen, Pokémon sammeln und das Team im Pokédex ansehen.
- Unter **Hohes Gras** Token-Codes eingeben:
  - `WALD-01`
  - `GARTEN-02`
  - `HÖHLE-03`
- Im Pokémon-Center heilt der Beispielcode `HEIL-001` das Team.

Spielstände werden lokal im Browser auf dem jeweiligen Gerät gespeichert. Sie werden nicht automatisch zwischen Computer und Handy synchronisiert.

## Entwicklung

```powershell
npm install
npm run dev
```

Produktionsversion erstellen und lokal ansehen:

```powershell
npm run build
npm run preview
```

Die fertige statische App liegt nach dem Build in `dist/`.

## Projektaufbau

- `src/main.ts` – Oberfläche und Ereignisse
- `src/game/Battle.ts` – Kampfregeln und Zugablauf
- `src/game/TypeChart.ts` – Typvorteile und Resistenzen
- `src/game/TrainerProfile.ts` – Team, Wechsel und gespeicherte KP
- `src/game/ProfileRepository.ts` – Trainerprofile speichern und laden
- `src/data/pokemon.ts` – Pokémon und Attacken
- `src/data/settings.ts` – Token- und Heilcodes sowie Orden
- `public/assets/sprites/` – lokal gespeicherte Pokémon-Sprites

Die Sprites stammen aus dem [PokeAPI-Sprites-Repository](https://github.com/PokeAPI/sprites). Pokémon und zugehörige Namen/Marken sind Eigentum ihrer jeweiligen Rechteinhaber. Dieses Projekt ist ein privates, nicht kommerzielles Fanprojekt.


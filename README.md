# Pokémon-Entdeckertour

Eine kleine Web-App für eine Pokémon-Schnitzeljagd. Mehrere Geräte im selben lokalen Netzwerk können dieselbe App und dieselben Trainerprofile nutzen. Die Spielstände liegen zentral in einer SQLite-Datei auf dem Computer, der den Server startet.

## Schnellstart unter Windows

1. **Node.js (LTS)** installieren: <https://nodejs.org/>
2. Das Repository über **Code → Download ZIP** herunterladen und entpacken. Alternativ per Git klonen:

   ```powershell
   git clone https://github.com/notAllThose/Pokemon-Schnitzeljagd.git pokemon-entdeckertour
   ```
3. Im Projektordner **`start-app.cmd`** doppelklicken. Beim ersten Start lädt das Skript die Abhängigkeiten herunter.
4. Das schwarze Fenster geöffnet lassen. Am Computer Chrome oder Edge öffnen und **http://localhost:5173/** aufrufen.

Das Fenster startet den Webserver und die gemeinsame Datenbank. `index.html` bitte nicht direkt doppelklicken.

## Mehrere Geräte mit demselben Spielstand verbinden

Der Computer, auf dem `start-app.cmd` läuft, ist der Spielserver. Alle Geräte müssen mit demselben lokalen Netzwerk (zum Beispiel demselben WLAN) verbunden sein.

1. Den Server am Computer starten und das Fenster geöffnet lassen.
2. Unter Windows `ipconfig` ausführen und die **IPv4-Adresse der WLAN-Verbindung** suchen, zum Beispiel `192.168.1.42`.
3. Auf jedem Gerät einen Browser öffnen und `http://192.168.1.42:5173/` aufrufen. Ersetze die Beispiel-IP durch die lokale IPv4-Adresse des Server-Computers.
4. Falls Windows nachfragt, Node.js den Zugriff im **privaten Netzwerk** erlauben.
5. Trainerprofile können an jedem Handy erstellt und in der Trainer-Auswahl aktualisiert werden. Pokémon, KP, Orden und Fortschritt werden für alle Geräte gemeinsam gespeichert.

Jedes Kind sollte während des Spiels möglichst dasselbe Gerät benutzen. Ein Trainerprofil sollte nicht gleichzeitig auf mehreren Geräten geöffnet sein; bei parallelen Änderungen gilt der zuletzt gespeicherte Stand. Die App läuft auf Handy, Tablet oder Computer im Browser. Für eine Installation als PWA ist über die lokale WLAN-Adresse normalerweise HTTPS erforderlich.

## Spielstände und Datenschutz

Die gemeinsame Datenbank ist die Datei `data/entdeckertour.sqlite` auf dem Server-Computer. Sie wird beim ersten Start automatisch angelegt, bleibt auf diesem Computer und wird nicht ins GitHub-Repository hochgeladen. Zum Sichern den Server beenden und diese Datei kopieren.

Die Browser behalten zusätzlich die zuletzt ausgewählte Trainerkarte und eine lokale Kopie für den Start. Der Server ist für das private WLAN gedacht: Er hat in diesem Prototyp keine Anmeldung. Bitte den Port nicht ins öffentliche Internet weiterleiten.

## Was man ausprobieren kann

- Neue Trainerprofile anlegen und zwischen ihnen wechseln.
- Starter auswählen, Kämpfe spielen, Pokémon sammeln und das Team im Pokédex ansehen.
- Unter **Hohes Gras** Token-Codes eingeben:
  - `WALD-01`
  - `GARTEN-02`
  - `HÖHLE-03`
- Im Pokémon-Center heilt der Beispielcode `HEIL-001` das Team.

## Entwicklung

```powershell
npm install
npm run dev
```

`npm run dev` startet Vite und die lokale API. Die SQLite-Datei wird von `server.js` über `sql.js` (WebAssembly) gelesen und geschrieben; native C++-Buildtools sind nicht erforderlich.

Produktionsversion erstellen und mit API starten:

```powershell
npm run build
npm start
```

Die fertige Web-App liegt nach dem Build in `dist/`. `npm run preview` dient nur zur Vorschau der statischen Dateien und stellt die gemeinsame Datenbank nicht bereit.

## Projektaufbau

- `src/main.ts` – Oberfläche und Ereignisse
- `src/game/Battle.ts` – Kampfregeln und Zugablauf
- `src/game/TypeChart.ts` – Typvorteile und Resistenzen
- `src/game/TrainerProfile.ts` – Team, Wechsel und gespeicherte KP
- `src/game/ProfileRepository.ts` – lokale Kopie und Synchronisierung der Trainerprofile
- `server.js` – gemeinsame SQLite-Datenbank und Produktionsserver
- `scripts/dev.js` – Entwicklungsserver für API und Vite
- `src/data/pokemon.ts` – Pokémon und Attacken
- `src/data/settings.ts` – Token- und Heilcodes sowie Orden
- `public/assets/sprites/` – lokal gespeicherte Pokémon-Sprites

Die Sprites stammen aus dem [PokeAPI-Sprites-Repository](https://github.com/PokeAPI/sprites). Pokémon und zugehörige Namen/Marken sind Eigentum ihrer jeweiligen Rechteinhaber. Dieses Projekt ist ein privates, nicht kommerzielles Fanprojekt.

Die Pokémon-Rufdateien stammen aus dem [PokeAPI Cries Repository](https://github.com/PokeAPI/cries) und werden lokal mit der App ausgeliefert. Die Wald-, Garten- und Höhlenkulissen sind eigene SVG-Grafiken für dieses Projekt.

# Dev-Handbuch – Pokémon-Entdeckertour

Dieses Dokument erklärt den technischen Aufbau der App so, dass man ihn später selbst vorstellen, warten und erweitern kann. Es beschreibt den Stand der Dateien im Repository und ergänzt die praktische Startanleitung in [README.md](README.md).

## 1. Was ist die App technisch?

Die Entdeckertour besteht aus zwei Teilen:

1. **Frontend:** eine im Browser laufende Single-Page-App. Sie ist in TypeScript geschrieben und wird mit Vite zu HTML, JavaScript und CSS gebaut.
2. **Spielserver:** ein kleiner Node.js-HTTP-Server. Er liefert in der fertigen Version die gebaute App aus und stellt eine JSON-API für Trainerprofile bereit. Die Profile werden zentral in SQLite gespeichert.

Im Entwicklungsmodus sind Frontend und API zwei getrennte Prozesse. Vite liefert die Dateien aus und leitet `/api`-Anfragen an den API-Server weiter. In der fertigen Version erledigt `server.js` beides über denselben HTTP-Server.

```text
Browser / Handy
   │
   ├── HTML, CSS, JavaScript, Sprites, Audio ──► Vite (Entwicklung)
   │                                               oder server.js (Produktion)
   │
   └── HTTP /api/profiles ─────────────────────► server.js
                                                   │
                                                   └── data/entdeckertour.sqlite
```

Alle Geräte, die dieselbe Serveradresse öffnen, sprechen mit derselben API und sehen dadurch denselben Profilbestand. Die Browser-Kopie dient als lokaler Komfortspeicher; die SQLite-Datei auf dem Server ist die gemeinsame persistente Ablage.

## 2. Projektstruktur

| Pfad | Aufgabe |
| --- | --- |
| `index.html` | Seitenstruktur, Dialoge, Formulare und Platzhalter für die Oberflächen. |
| `style.css` | Layout, Farben, responsive Darstellung, Pokédex- und Kampfbildschirm sowie Animationen. |
| `src/main.ts` | App-Einstieg und Ablaufsteuerung: Ereignisse, Seitenwechsel, Traineraktionen, Begegnung und Kampf. |
| `src/domain/types.ts` | Gemeinsame TypeScript-Typen und Datenverträge wie `TrainerSave`, `Move` und `PokemonDefinition`. |
| `src/data/pokemon.ts` | Statische Pokémon-Dexeinträge, Typen, KP und Attacken. |
| `src/data/settings.ts` | Starter, Token-Codes, Fundortzuordnung, Heilcode und Orden. |
| `src/game/TrainerProfile.ts` | Regeln und Operationen für ein einzelnes Trainerprofil. |
| `src/game/ProfileRepository.ts` | Profil-Lebenszyklus, Browser-Kopie und Synchronisierung über die API. |
| `src/game/Battle.ts` | Flüchtiger Kampfzustand und Kampfregeln. |
| `src/game/TypeChart.ts` | Effektivitäten, Resistenzen und Immunitäten der Typen. |
| `src/ui/BattleView.ts` | Zeichnet den Zustand eines Kampfes in den Battle-Dialog. |
| `src/ui/PokedexView.ts` | Zeichnet Sammlung, Pokédex-Liste und Pokémon-Details. |
| `src/ui/GameMessageDialog.ts` | Zentrale, gut lesbare Mitteilungen und Fangsequenz. |
| `src/ui/SceneAnimator.ts` | Seiten-, Pokécenter-, Pokédex- und Hohes-Gras-Übergänge. |
| `src/ui/AudioManager.ts` | Pokémon-Rufe, Kampfmusik, Attacken- und Ereignissounds. |
| `src/ui/dom.ts` | Hilfsfunktion zum typisierten Suchen verpflichtender DOM-Elemente. |
| `server.js` | HTTP-API, Produktionsauslieferung, SQLite-Lesen/Schreiben und Serverprotokoll. |
| `scripts/dev.js` | Startet Vite und den API-Server gemeinsam für die Entwicklung. |
| `vite.config.ts` | Entwicklungsserver: Netzwerkzugriff, `/api`-Proxy und App-Root. |
| `public/assets/` | Lokal ausgelieferte Sprites, Kampfkulissen und Rufdateien. |
| `data/entdeckertour.sqlite` | Laufzeit-Datenbank. Sie wird automatisch erzeugt und ist absichtlich nicht im Git-Repository. |
| `dist/` | Ergebnis von `npm run build`; wird erzeugt und ebenfalls nicht eingecheckt. |

## 3. Server und Laufmodi

### Entwicklung

`npm run dev` führt `scripts/dev.js` aus. Das Skript startet zwei Kindprozesse:

- `server.js --api-only` auf Port `3001`, nur für die API und SQLite.
- Vite auf Port `5173`, erreichbar über das lokale Netzwerk.

Vite leitet den Pfad `/api` an `http://127.0.0.1:3001` weiter. Die Browseradresse bleibt dadurch dieselbe, zum Beispiel `http://localhost:5173/` oder `http://<lokale-ip>:5173/`. Beenden von `npm run dev` beendet beide Prozesse.

### Produktion bzw. lokaler Spielserver

`npm run build` führt zuerst den TypeScript-Compiler im Prüfmodus (`tsc --noEmit`) und anschließend Vite aus. Die statische App landet im Ordner `dist/`. `npm start` startet danach `server.js` auf Port `5173` (oder auf dem Wert aus `PORT`).

Ohne `--api-only` bedient `server.js` sowohl `/api/...` als auch die Dateien aus `dist/`. Falls `dist/index.html` fehlt, antwortet der Server mit HTTP 503 und einem Hinweis, zuerst zu bauen. `npm run preview` ist dagegen nur Vites Dateivorschau und stellt die gemeinsame SQLite-API nicht bereit.

Der Server bindet an `0.0.0.0`, damit andere Geräte im selben Netzwerk zugreifen können. Das ist für das private WLAN während der Feier gedacht. Der Prototyp hat keine Anmeldung und sollte nicht durch Portfreigaben ins öffentliche Internet gestellt werden.

## 4. HTTP-API

Die API ist absichtlich klein und verwaltet Trainerprofile als Ganzes:

| Methode | Pfad | Wirkung |
| --- | --- | --- |
| `GET` | `/api/profiles` | Gibt alle Profile sortiert nach letzter Aktualisierung und ID zurück. |
| `PUT` | `/api/profiles/:id` | Legt ein Profil an oder ersetzt den gespeicherten Stand für diese ID. |
| `DELETE` | `/api/profiles` | Löscht alle Trainerprofile. Die App fragt vor dem Aufruf nach einer Bestätigung. |

Beispiel für den JSON-Inhalt eines `PUT`-Requests:

```json
{
  "profile": {
    "id": "trainer-beispiel",
    "trainer": "Mia",
    "starter": "pikachu",
    "collection": ["pikachu", "raupy"],
    "badges": ["mut"],
    "activePokemonId": "pikachu",
    "hpByPokemon": { "pikachu": 18, "raupy": 17 },
    "habitatByPokemon": { "pikachu": "forest", "raupy": "forest" }
  }
}
```

Die ID im URL-Pfad und `profile.id` müssen übereinstimmen. Der Server prüft zusätzlich, ob eine Trainerzeichenkette vorhanden ist. Requests über 1 MiB werden abgewiesen; ungültiges JSON bekommt HTTP 400, ein unbekannter API-Pfad HTTP 404. JSON-Antworten werden ohne Cache ausgeliefert.

### Was wird protokolliert?

Jede API-Anfrage erhält eine laufende Nummer. Das Serverfenster zeigt Methode und URL, Query- und Path-Parameter, Request-Body, Datenbankoperation samt SQL/Parametern sowie Statuscode, Antwort und Laufzeit. Lange Werte werden zur Lesbarkeit gekürzt. Diese Protokolle sind für lokale Fehlersuche gedacht; es sind keine dauerhaften Audit-Logs.

## 5. SQLite-Datenmodell

Die Datenbankdatei heißt `data/entdeckertour.sqlite`. Sie wird beim ersten Start erzeugt. Der Server nutzt `sql.js` (SQLite in WebAssembly), damit keine nativen Datenbank-Buildtools installiert werden müssen. Beim Start wird die Datei in den Arbeitsspeicher geladen. Nach jeder Änderung exportiert `server.js` den vollständigen SQLite-Inhalt in eine temporäre Datei `entdeckertour.sqlite.tmp` und benennt sie danach in die eigentliche Datei um. So wird die Datei nicht stückweise überschrieben.

Das Schema besteht momentan aus einer Tabelle:

```sql
CREATE TABLE trainer_profiles (
  id         TEXT PRIMARY KEY,
  data_json  TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

- **`id`** ist die stabile Profilkennung und der Primärschlüssel.
- **`data_json`** enthält das vollständige Profil als JSON-Text.
- **`updated_at`** enthält den ISO-Zeitpunkt des letzten Speicherns und wird für die Sortierung der Profilliste genutzt.

Pokémon, Attacken, Fundortcodes und Orden sind keine eigenen Datenbankzeilen: Sie sind Spieldefinitionen in TypeScript (`src/data/`). Gespeichert werden nur die Änderungen/Fortschritte der Trainer. Die Tabelle lässt sich schematisch so lesen:

| id | data_json (Inhalt) | updated_at |
| --- | --- | --- |
| `trainer-…` | Name, Starter, Sammlung, Orden, aktives Pokémon, KP und Fundorte | `2026-11-06T…Z` |

Die Datei nicht löschen, wenn die Spielstände erhalten bleiben sollen. Zum Backup den Server beenden und die SQLite-Datei kopieren. Die Datenbank ist in `.gitignore` ausgeschlossen und wird nicht mit GitHub synchronisiert.

## 6. Profil- und Speichermodell

### `TrainerSave`

`src/domain/types.ts` definiert die serialisierbare Form eines Trainerprofils:

```ts
interface TrainerSave {
  id: string;
  trainer: string;
  starter: string;
  collection: string[];
  badges: string[];
  activePokemonId: string;
  hpByPokemon: Record<string, number>;
  habitatByPokemon: Record<string, EncounterHabitat>;
}
```

Die Sammlung enthält Pokémon-IDs, nicht vollständige Kopien ihrer Dexdefinitionen. Name, Bild, Typen und Attacken werden zur Laufzeit aus `POKEMON` nachgeschlagen. `hpByPokemon` speichert verbleibende KP pro Pokémon, `habitatByPokemon` merkt sich den Fangort für die Kulisse im Pokédex und Fangbildschirm.

### `TrainerProfile`

Diese Klasse kapselt Regeln für genau einen Trainer: fehlende IDs/Standardwerte ergänzen, ältere Spielstände auffüllen, Pokémon hinzufügen, KP begrenzen, lebende Teammitglieder auflisten, aktives Pokémon wechseln und das ganze Team heilen. Sie verändert dabei ihr `data`-Objekt; `ProfileRepository.save()` muss anschließend aufgerufen werden, damit Änderungen dauerhaft gespeichert werden.

### `ProfileRepository`

Diese Klasse ist die Brücke zwischen App und Speicherung:

- speichert Trainerprofile im `localStorage` als Browser-Kopie unter `entdeckertour-profiles` (und liest zur Migration einmalig den alten Schlüssel `entdeckertour-save`),
- lädt und speichert den gemeinsamen Stand über die HTTP-API,
- hält die aktive Trainer-ID für den nächsten Besuch auf demselben Browser fest,
- serialisiert Schreibrequests über eine Promise-Warteschlange und fasst schnelle Änderungen auf den neuesten Profilstand zusammen,
- behält noch nicht bestätigte lokale Änderungen als ausstehende Profile, wenn die Profilliste aktualisiert wird.

Beim ersten Verbinden werden lokale Profile, deren IDs auf dem Server noch fehlen, hochgeladen. Existiert dieselbe ID bereits auf dem Server, gilt der Serverstand. Danach wird die zentrale Liste geladen. Deshalb ist die Trainer-ID wichtig: Geräte ordnen Profilupdates anhand dieser ID demselben Datensatz zu.

Die Sync-Strategie ist kein ausgefeiltes Konfliktmanagement. Wird dieselbe Trainerkarte gleichzeitig auf zwei Geräten geändert, kann der zuletzt beim Server eintreffende vollständige Profilstand den vorherigen überschreiben. Im normalen Ablauf sollte jedes Kind sein Profil auf einem Gerät verwenden.

## 7. Spielmodell und Kampf

### Pokémon- und Attackendefinitionen

`src/data/pokemon.ts` ist der statische Pokédex der kleinen Feier-Version. Jeder `PokemonDefinition` enthält unter anderem Dexnummer, deutsche Bezeichnung, Kategorie, Beschreibung, Größe, Gewicht, Typ(en), Darstellungsfarbe, maximale KP und vier Attacken. Eine Attacke (`Move`) hat Namen, Typ, Stärke und optional einen Effekt. Die App unterscheidet so zwischen Spielregeln und Trainerfortschritt: die Definition beschreibt *was ein Pokémon ist*, das Profil hält *was dieses Kind besitzt und wie viele KP übrig sind*.

`src/data/settings.ts` enthält die Spielkonfiguration für Starter, Token-Codes samt Pokémon-ID und Fundort, den Erwachsenen-Heilcode sowie Orden. Für ein neues Versteck müssen Code, Pokémon und Habitat in den dortigen Zuordnungen passend ergänzt werden. Passende Kulissen liegen in `public/assets/backgrounds/`.

### `Battle` und `TypeChart`

`Battle` ist ein nur für die laufende Begegnung existierendes Objekt. Es merkt sich Gegner-ID, gegnerische KP, Fundort, Ergebnis (`playing`, `win`, `lose`) und den Ausweichzustand. Trainer-KP werden nicht separat im Kampfobjekt gehalten: Änderungen gehen über `TrainerProfile.setHp()` direkt ins Trainerprofil, damit `ProfileRepository.save()` sie auch während des Kampfes synchronisieren kann. Wird der Kampf geschlossen, verschwindet das `Battle`-Objekt; die gespeicherten KP bleiben.

Bei einer Trainerattacke wird die Stärke um einen kleinen Zufallswert variiert und dann mit dem Typfaktor verrechnet. Die Gegner-KI wählt zufällig eine Attacke mit Schadentyp; sie plant nicht strategisch und wählt keine Attacke aufgrund eines Typvorteils. Beide Seiten verwenden `TypeChart.multiplier()`.

Die Tabelle in `TypeChart.ts` beschreibt Vorteile (`×2`), Resistenzen (`×0,5`) und Immunitäten (`×0`). Bei dualen Typen wird der Faktor für beide Verteidigertypen multipliziert: zum Beispiel `×2 ×0,5 = ×1`. Nicht ausdrücklich aufgeführte Kombinationen sind neutral. Die vereinfachte Schadensformel soll den Typvorteil für Kinder verständlich spürbar machen, bildet aber nicht sämtliche Kampfmechaniken der Hauptspiele ab.

### Kampfzug in der Oberfläche

Der Ablauf wird in `EntdeckertourApp` koordiniert:

1. Ein gültiger Token-Code identifiziert Pokémon und Habitat.
2. Das Kind wählt Information oder Kampf. Der Kampf erzeugt ein `Battle` und öffnet den Kampfdialog.
3. Ein Klick auf Attacke ruft `Battle.trainerAttack()` auf, spielt Sound und visuelle Aktion, speichert Profil-KP und zeigt den Schaden.
4. Wenn der Gegner noch steht, folgt nach einer kurzen Pause `Battle.opponentAttack()`; auch dieser KP-Stand wird gespeichert.
5. Ist das eigene Pokémon besiegt, kann ein lebendes Teammitglied ohne gegnerischen Gegenzug eingewechselt werden. Ein freiwilliger Wechsel verbraucht einen Zug.
6. Bei Sieg läuft die Fangsequenz; danach nimmt `TrainerProfile.addPokemon()` das Pokémon mit vollen KP und Fundort ins Team auf und speichert das Ergebnis.

`turnLocked` verhindert, dass schnelle wiederholte Klicks mehrere Aktionen während derselben Animation auslösen. `BattleView` kümmert sich um Statusanzeigen, Sprites, KP-Balken, Schaden und Attackeneffekte; `AudioManager` spielt Musik und Effekte.

## 8. Oberflächenklassen und Navigation

`EntdeckertourApp` in `src/main.ts` ist der Ablauf-Controller. Sie bindet die DOM-Ereignisse, hält momentan aktives Profil, Seite und Kampf und ruft Fach- und UI-Klassen auf. Die Darstellung ist bewusst auf weitere Klassen verteilt:

- `PokedexView` erstellt Liste und Details anhand des Trainerprofils und der statischen Dexdaten.
- `BattleView` aktualisiert den Kampfbildschirm, ohne selbst Spielregeln zu entscheiden.
- `GameMessageDialog` zeigt zentrale Textmeldungen und den Pokéball-Fangmoment.
- `SceneAnimator` steuert die Übergänge für normale Seiten, Pokécenter, Pokédex und Hohes Gras.
- `AudioManager` kapselt Web-Audio und lokale Pokémon-Rufe.
- `dom.ts` wirft früh einen klaren Fehler, wenn ein erwartetes HTML-Element fehlt.

Seiten und Dialoge sind in `index.html` vorbereitet. `main.ts` bindet Ereignisse größtenteils delegiert an übergeordnete Elemente; dadurch funktionieren auch Buttons, die später dynamisch in die Seite gerendert werden. Nach dem Erstellen/Ändern eines UI-Elements müssen der HTML-Selektor und der TypeScript-Code zusammenpassen.

## 9. Typische Abläufe zum Erweitern

### Pokémon oder Attacke hinzufügen

1. Definition in `src/data/pokemon.ts` ergänzen (stabile ID, Typen, KP und Attacken).
2. Bei einem Starter die ID zu `STARTER_IDS` hinzufügen.
3. Bilder/Sprites passend zur verwendeten ID unter `public/assets/sprites/` ablegen.
4. Wenn es ein Wildfund ist, Token und Habitat in `src/data/settings.ts` zuordnen.
5. Optional Rufdatei unter `public/assets/cries/<dexnummer>.ogg` ablegen; `AudioManager` verwendet diese Dexnummer-Dateien.
6. Für eine charakteristische Attackenanimation oder einen eigenen Effekt die Zuordnung in `AudioManager` bzw. die Effektbehandlung in `BattleView`/CSS ergänzen.

### Neuen Fundort hinzufügen

1. Habitat als Wert von `EncounterHabitat` in `src/domain/types.ts` eintragen.
2. Token-Code in `WILD_TOKEN_HABITATS` darauf zeigen lassen.
3. Einen passenden Hintergrund unter `public/assets/backgrounds/` ergänzen.
4. Prüfen, dass die Hintergrundauswahl in Pokédex, Kampf- und Fangdarstellung den neuen Habitatnamen verwendet.

### Profilfeld ergänzen

1. Feld in `TrainerSave` ergänzen.
2. Standardwert und mögliche Migration in `TrainerProfile` setzen, damit bestehende JSON-Profile weiter geladen werden.
3. Falls das Feld durch Kinder geändert wird, die UI-Aktion über `ProfileRepository.save()` persistieren.
4. Server-Schema ist für Profilfelder nicht anzupassen, da `data_json` das Profilobjekt als JSON aufnimmt. Bei einer echten Datenbankmigration (neue Spalte/Index/Tabelle) muss dagegen `server.js` ein `CREATE TABLE`/`ALTER TABLE` bekommen.

## 10. PWA, Assets und Offline-Verhalten

`manifest.webmanifest` beschreibt Name, Farben und Startverhalten der installierbaren Web-App. `public/sw.js` cached die gebaute Oberfläche und lokale Assets für Offline-Nutzung. Die Registrierung erfolgt nur über HTTP/HTTPS, nicht bei `file://`; im Entwicklungsmodus entfernt `main.ts` alte Service-Worker-Caches, damit Vite nicht von veralteten Dateien überlagert wird.

Die Bild- und Audioassets unter `public/assets/` werden lokal ausgeliefert. Der Browser benötigt deshalb für Sprites, Rufdateien und Hintergründe beim Spielen keine externe Asset-API. Die gemeinsame Profil-API und der Server müssen dennoch erreichbar sein, um Änderungen zwischen Geräten zu synchronisieren.

## 11. Hinweise und Grenzen des aktuellen Prototyps

- Es gibt keine Benutzerkonten oder Berechtigungen. Wer im erreichbaren WLAN die App öffnet, kann Profile anlegen; der Reset-Endpunkt löscht alle Profile.
- Profile werden als vollständiges JSON-Dokument pro Trainer gespeichert, nicht als normalisierte Tabellen pro Pokémon.
- Schreibkonflikte derselben Trainer-ID auf verschiedenen Geräten werden nicht zusammengeführt.
- Kampfzustand (gegnerische KP und Kampfergebnis) ist nicht dauerhaft gespeichert. Dauerhaft sind die Profil-KP und der Fang nach Sieg.
- Die API hat einfache Plausibilitätsprüfung, aber kein strenges Schema-Validierungspaket.
- `sql.js` hält die Datenbank während der Laufzeit im RAM. Für diesen Einzelserver ist das einfach und ausreichend; bei Prozessabsturz vor dem nächsten synchronen Speichervorgang gibt es keine zusätzliche Transaktions- oder Replikationsschicht.
- Die verwendeten Sprites, Pokémon-Namen, Rufe und Kampfkulissen stammen aus Drittquellen; die README nennt die bekannten Quellen. Das Projekt ist ein privates Fanprojekt.

## 12. Nützliche Befehle

```powershell
npm install       # Abhängigkeiten installieren
npm run dev       # API und Vite für Entwicklung starten
npm run build     # TypeScript prüfen und dist/ bauen
npm start         # Gebaute App und gemeinsame API starten
npm run preview   # Nur statische Build-Vorschau, ohne gemeinsame API
```

`npm run build` ist der im Projekt definierte schnelle Integritätscheck. Es gibt derzeit keine separate Test-Suite.

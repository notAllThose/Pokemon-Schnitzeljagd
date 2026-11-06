import { POKEMON, STARTER_IDS } from './data/pokemon';
import { BADGES, HEAL_CODE, WILD_TOKEN_CODES, WILD_TOKEN_HABITATS } from './data/settings';
import type { EncounterHabitat, PokemonType } from './domain/types';
import { Battle } from './game/Battle';
import { ProfileRepository } from './game/ProfileRepository';
import { TypeChart } from './game/TypeChart';
import { TrainerProfile } from './game/TrainerProfile';
import { AudioManager } from './ui/AudioManager';
import { BattleView, type BattleEffect } from './ui/BattleView';
import { getElement as $ } from './ui/dom';
import { GameMessageDialog } from './ui/GameMessageDialog';
import { PokedexView } from './ui/PokedexView';
import { SceneAnimator } from './ui/SceneAnimator';

type AppPage = 'home' | 'pokemon' | 'found' | 'center' | 'badges';
type MenuPage = Exclude<AppPage, 'home'>;

const PAGE_SECTIONS: ReadonlyArray<readonly [MenuPage, string]> = [
  ['pokemon', '#pokemonPage'], ['found', '#foundPage'], ['center', '#centerPage'], ['badges', '#badgesPage'],
];

function isMenuPage(page: string | undefined): page is MenuPage {
  return page === 'pokemon' || page === 'found' || page === 'center' || page === 'badges';
}

/**
 * Die App-Klasse verbindet Oberfläche und Spielregeln.
 * Pokémon-Daten, Profile und Kämpfe liegen in eigenen Klassen/Dateien.
 */
class EntdeckertourApp {
  private readonly profiles = new ProfileRepository();
  private readonly audio = new AudioManager();
  private readonly battleView = new BattleView();
  private readonly scenes = new SceneAnimator(this.audio);
  private readonly messages = new GameMessageDialog(this.audio);
  private readonly pokedexView = new PokedexView();
  private profile: TrainerProfile | null = this.profiles.active;
  private battle: Battle | null = null;
  private encounterPokemonId = '';
  private currentEncounterHabitat: EncounterHabitat = 'meadow';
  private returnToEncounter = false;
  private returnPageAfterDex: AppPage = 'found';
  private turnLocked = false;
  private currentPage: AppPage = 'home';

  constructor() {
    this.bindEvents();
    this.render();
    void this.connectToSharedGame();
    window.setInterval(() => {
      // Beim Trainer-Auswahlbildschirm können andere Eltern neue Profile anlegen.
      if (!this.profile && !this.dialog('#switchDialog').open) void this.refreshTrainerList();
    }, 5000);
    // Ein Manifest und ein Service Worker funktionieren auf einer Webadresse,
    // aber nicht, wenn die HTML-Datei direkt als file:// geöffnet wird.
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      const manifest = document.createElement('link');
      manifest.rel = 'manifest';
      manifest.href = 'manifest.webmanifest';
      document.head.append(manifest);
      if (import.meta.env.PROD) {
        window.addEventListener('load', () => navigator.serviceWorker?.register('./sw.js').catch(() => undefined));
      } else {
        // Nie Vite-Entwicklungsdateien offline zwischenspeichern. Alte Registrierungen
        // derselben App werden entfernt, damit sie kein veraltetes HTML zurückgeben.
        navigator.serviceWorker?.getRegistrations().then(registrations => {
          const appScope = new URL('./', location.href).href;
          registrations.filter(registration => registration.scope === appScope).forEach(registration => registration.unregister());
          caches.keys().then(keys => keys.filter(key => key.startsWith('entdeckertour-')).forEach(key => caches.delete(key)));
        });
      }
    }
  }

  private bindEvents(): void {
    $('#brandHome').addEventListener('click', event => {
      if (this.profile?.name) {
        event.preventDefault();
        this.showPage('home');
      }
    });
    $('#starterChoices').addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-starter]');
      if (!button || !this.profile) return;
      this.profile.data.starter = button.dataset.starter ?? '';
      this.profile.data.activePokemonId = this.profile.data.starter;
      this.profiles.save();
      this.render();
    });

    $('#trainerName').addEventListener('input', () => {
      $('#beginButton').toggleAttribute('disabled', !this.canBegin());
    });
    $('#beginButton').addEventListener('click', () => this.beginJourney());
    $('#newProfileButton').addEventListener('click', () => this.createProfile());
    $('#addProfileButton').addEventListener('click', () => this.createProfile());
    $('#switchTrainer').addEventListener('click', async () => {
      await this.refreshTrainerList();
      this.renderProfileButtons('#switchList');
      this.dialog('#switchDialog').showModal();
    });
    $('#refreshProfilesButton').addEventListener('click', () => { void this.refreshTrainerList(); });
    $('#switchList').addEventListener('click', event => this.selectProfileFrom(event));
    $('#profileList').addEventListener('click', event => this.selectProfileFrom(event));
    $('#mainMenu').addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-open-page]');
      const page = button?.dataset.openPage;
      if (isMenuPage(page)) this.navigateTo(page);
    });
    $('#game').addEventListener('click', event => {
      if ((event.target as HTMLElement).closest('[data-page-back]')) this.showPage('home');
    });

    $('#encounterForm').addEventListener('submit', event => {
      event.preventDefault();
      this.startEncounter(this.input('#tokenCode').value.trim().toUpperCase());
    });
    $('#encounterContent').addEventListener('click', event => {
      const action = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-encounter-action]')?.dataset.encounterAction;
      if (action === 'info') this.openPokedex(this.encounterPokemonId, true);
      if (action === 'fight') this.beginBattle(this.encounterPokemonId);
    });
    $('#pokedexContent').addEventListener('click', event => {
      const action = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-pokedex-action]')?.dataset.pokedexAction;
      if (action === 'previous' || action === 'next') {
        const collection = this.profile?.collection ?? [];
        const currentIndex = collection.indexOf(this.encounterPokemonId);
        const nextIndex = currentIndex + (action === 'next' ? 1 : -1);
        const nextPokemonId = collection[nextIndex];
        if (nextPokemonId) this.openPokedex(nextPokemonId, false, action);
        return;
      }
      if (action === 'back') {
        if (this.returnToEncounter) {
          this.showDexList();
          this.showPage(this.returnPageAfterDex);
          this.dialog('#encounterDialog').showModal();
        } else {
          this.showDexList();
        }
      }
      if (action === 'fight') this.beginBattle(this.encounterPokemonId);
    });
    $('#collection').addEventListener('click', event => {
      const card = (event.target as HTMLElement).closest<HTMLElement>('[data-pokemon]');
      if (card?.dataset.pokemon) this.openPokedex(card.dataset.pokemon, false);
    });
    document.querySelectorAll<HTMLButtonElement>('.demo-code').forEach(button => {
      button.addEventListener('click', () => {
        this.input('#tokenCode').value = button.dataset.code ?? '';
        this.form('#encounterForm').requestSubmit();
      });
    });
    $('#healForm').addEventListener('submit', event => {
      event.preventDefault();
      this.healTeam(this.input('#healCode').value.trim().toUpperCase());
    });
    $('#resetButton').addEventListener('click', () => this.resetProfiles());
    $('#battleContent').addEventListener('click', event => this.handleBattleClick(event));
    this.dialog('#battleDialog').addEventListener('close', () => {
      this.audio.stopBattleTheme();
      // Schließen per X aktualisiert ebenfalls die angezeigten Trainer-KP.
      if (this.battle) {
        this.battle = null;
        this.render();
      }
    });
  }

  private canBegin(): boolean {
    return !!this.input('#trainerName').value.trim() && !!this.profile?.starter;
  }

  private beginJourney(): void {
    if (!this.profile || !this.canBegin()) return;
    this.profile.data.trainer = this.input('#trainerName').value.trim();
    this.profile.addPokemon(this.profile.starter);
    this.profile.switchTo(this.profile.starter);
    this.profiles.save();
    this.currentPage = 'home';
    this.render();
  }

  private createProfile(): void {
    this.profile = this.profiles.create();
    this.dialog('#switchDialog').close();
    this.input('#trainerName').value = '';
    this.render();
    this.input('#trainerName').focus();
  }

  private selectProfileFrom(event: Event): void {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-profile]');
    const profileId = button?.dataset.profile;
    if (!profileId) return;
    this.profile = this.profiles.select(profileId);
    this.dialog('#switchDialog').close();
    this.battle = null;
    this.currentPage = 'home';
    this.render();
  }

  private startEncounter(code: string): void {
    const pokemonId = WILD_TOKEN_CODES[code];
    if (!this.profile || !pokemonId) return this.showGameMessage('Diesen Code kenne ich nicht.');
    if (this.profile.collection.includes(pokemonId)) return this.showGameMessage(`${POKEMON[pokemonId].name} ist schon im Team.`);
    if (!this.profile.livingPokemon().length) return this.showGameMessage('Dein Team braucht Erholung im Pokémon-Center.');
    this.encounterPokemonId = pokemonId;
    this.currentEncounterHabitat = WILD_TOKEN_HABITATS[code] ?? 'meadow';
    this.input('#tokenCode').value = '';
    this.scenes.playGrassTransition(pokemonId, () => {
      this.renderEncounterChoice(pokemonId);
      this.dialog('#encounterDialog').showModal();
    });
  }

  private navigateTo(page: AppPage): void {
    if (page === 'found') {
      this.scenes.playGrassTransition(null, () => this.showPage('found'));
      return;
    }
    if (page === 'center') {
      this.scenes.playCenterTransition('enter', () => this.showPage(page));
      return;
    }
    this.scenes.playPageTransition(
      () => {
        this.showPage(page);
        const pageElement = $(`#${page}Page`);
        pageElement.classList.add('page-reveal');
      },
      () => $(`#${page}Page`).classList.add('page-revealed'),
      () => {
        $(`#${page}Page`).classList.remove('page-reveal', 'page-revealed');
        if (page === 'pokemon') {
          this.showDexList();
          this.scenes.animatePokedexOpening();
        }
      },
    );
  }

  private beginBattle(pokemonId: string): void {
    const trainerProfile = this.profile;
    if (!trainerProfile) return;
    this.encounterPokemonId = pokemonId;
    this.audio.playPokemonCry(pokemonId);
    if (this.returnToEncounter) {
      this.showDexList();
      this.showPage(this.returnPageAfterDex);
    }
    this.dialog('#encounterDialog').close();
    this.battle = new Battle(trainerProfile, pokemonId, this.currentEncounterHabitat);
    this.turnLocked = false;
    this.renderBattle('Ein wildes Pokémon taucht auf!');
    this.dialog('#battleDialog').showModal();
    this.audio.startBattleTheme();
  }

  private openPokedex(pokemonId: string, returnToEncounter: boolean, slideDirection?: 'previous' | 'next'): void {
    const pokemon = POKEMON[pokemonId];
    if (!pokemon) return;
    // Der Tap auf einen Pokédex-Eintrag ist eine direkte Nutzeraktion, sodass
    // mobile Browser den Ruf zuverlässig abspielen dürfen.
    this.audio.playPokemonCry(pokemonId);
    this.encounterPokemonId = pokemonId;
    this.returnToEncounter = returnToEncounter;
    this.returnPageAfterDex = this.currentPage;
    if (returnToEncounter) this.dialog('#encounterDialog').close();
    this.showPage('pokemon');
    $('#pokedexListView').classList.add('hidden');
    $('#pokedexDetailView').classList.remove('hidden');
    this.pokedexView.renderDetail(pokemonId, this.profile, {
      returnToEncounter,
      encounterHabitat: this.currentEncounterHabitat,
      playMotion: true,
    });
    if (slideDirection) {
      const content = $('#pokedexContent');
      content.classList.remove('dex-slide-next', 'dex-slide-previous');
      void content.offsetWidth;
      content.classList.add(slideDirection === 'next' ? 'dex-slide-next' : 'dex-slide-previous');
      return;
    }
    const device = $('#pokedexDevice');
    device.classList.remove('appearing');
    void device.offsetWidth;
    device.classList.add('appearing');
    window.setTimeout(() => device.classList.remove('appearing'), 400);
  }

  private showDexList(): void {
    this.returnToEncounter = false;
    $('#pokedexDetailView').classList.add('hidden');
    $('#pokedexListView').classList.remove('hidden');
  }

  private renderEncounterChoice(pokemonId: string): void {
    const pokemon = POKEMON[pokemonId];
    $('#encounterContent').innerHTML = `<p class="eyebrow">WILDE BEGEGNUNG</p>
      <div class="encounter-mon ${pokemon.color}"><img src="assets/sprites/${pokemonId}-front.gif" alt=""><div><span>Ein neues Pokémon!</span><h2>${pokemon.name}</h2><small>${pokemon.category}</small></div></div>
      <p class="encounter-question">Was möchtest du tun?</p>
      <div class="encounter-actions">
        <button class="encounter-option info-option" data-encounter-action="info" type="button"><span>📖</span><strong>Information</strong><small>Pokédex-Eintrag ansehen</small></button>
        <button class="encounter-option fight-option" data-encounter-action="fight" type="button"><span>⚔️</span><strong>Kampf</strong><small>Versuche es zu fangen!</small></button>
      </div>`;
  }

  private healTeam(code: string): void {
    if (!this.profile) return;
    if (code !== HEAL_CODE) return this.showGameMessage('Der Heilcode stimmt nicht. Frag eine erwachsene Person.');
    this.profile.healAll();
    this.profiles.save();
    this.input('#healCode').value = '';
    this.render();
    this.scenes.playCenterTransition('heal', () => this.showGameMessage('Dein ganzes Team ist wieder fit!'));
  }

  private handleBattleClick(event: Event): void {
    const target = event.target as HTMLElement;
    const moveButton = target.closest<HTMLButtonElement>('[data-move]');
    const switchButton = target.closest<HTMLButtonElement>('[data-switch-pokemon]');
    if (moveButton) this.chooseMove(Number(moveButton.dataset.move));
    const pokemonId = switchButton?.dataset.switchPokemon;
    if (pokemonId) this.switchPokemon(pokemonId);
    if (target.closest('#closeBattleButton')) {
      this.dialog('#battleDialog').close();
      this.battle = null;
      this.render();
    }
  }

  private chooseMove(index: number): void {
    const battle = this.battle;
    if (!battle || this.turnLocked || battle.result !== 'playing' || battle.needsReplacement) return;
    const selectedMove = battle.activePokemon.moves[index];
    if (!selectedMove) return;
    this.turnLocked = true;
    const action = battle.trainerAttack(index);
    this.audio.playMoveSound(selectedMove);
    this.profiles.save();
    const effectiveness = TypeChart.describe(action.effectiveness);
    const damageText = action.damage ? `${action.damage} KP Schaden. ` : '';
    const actionText = action.specialEffect === 'evade'
      ? `${action.attackerName} macht sich zum Ausweichen bereit! Der nächste Treffer kann verfehlen.`
      : `${action.attackerName} setzt ${action.moveName} ein! ${damageText}${effectiveness}`;
    this.renderBattle(actionText, 'trainer', action.damage, battle.activePokemon.moves[index]?.type ?? null);
    if (battle.isWon) {
      window.setTimeout(() => {
        if (this.battle !== battle) return;
        this.renderBattle(`Das wilde ${battle.opponent.name} wurde besiegt!`);
        this.audio.playVictoryJingle();
        window.setTimeout(() => this.addVictoryToTeam(battle), 1000);
      }, 800);
      return;
    }
    window.setTimeout(() => this.opponentTurn(), 850);
  }

  private switchPokemon(pokemonId: string): void {
    const battle = this.battle;
    if (!battle || !this.profile || battle.result !== 'playing') return;
    const isForced = battle.needsReplacement;
    if (this.turnLocked && !isForced) return;
    if (!battle.switchPokemon(pokemonId)) return this.showGameMessage('Dieses Pokémon braucht Erholung im Pokémon-Center.');
    this.profiles.save();
    this.turnLocked = !isForced;
    this.renderBattle(`${this.profile.name} schickt ${POKEMON[pokemonId].name} in den Kampf!`);
    // Ein freiwilliger Wechsel kostet einen Zug; ein Ersatz nach K.O. nicht.
    if (!isForced) window.setTimeout(() => this.opponentTurn(), 650);
  }

  private opponentTurn(): void {
    const battle = this.battle;
    if (!battle || battle.result !== 'playing') return;
    const action = battle.opponentAttack();
    this.profiles.save();
    this.turnLocked = true;
    const effectiveness = TypeChart.describe(action.effectiveness);
    const damageText = action.damage ? `${action.damage} KP Schaden. ` : '';
    const actionText = action.specialEffect === 'dodged'
      ? `${action.attackerName} setzt ${action.moveName} ein, aber dein Pokémon weicht aus!`
      : `${action.attackerName} setzt ${action.moveName} ein! ${damageText}${effectiveness}`;
    const opponentMove = battle.opponent.moves.find(move => move.name === action.moveName);
    const moveType = opponentMove?.type ?? null;
    if (opponentMove) this.audio.playMoveSound(opponentMove);
    this.renderBattle(actionText, 'wild', action.damage, moveType);
    if (battle.result !== 'playing' || battle.needsReplacement) return;
    window.setTimeout(() => {
      this.turnLocked = false;
      this.renderBattle(`Was soll ${battle.activePokemon.name} tun?`);
    }, 650);
  }

  private addVictoryToTeam(battle: Battle): void {
    if (!this.profile || this.battle !== battle) return;
    const pokemon = battle.opponent;
    this.profile.addPokemon(pokemon.id, battle.habitat);
    this.profiles.save();
    this.dialog('#battleDialog').close();
    this.battle = null;
    this.render();
    this.messages.showCapture(pokemon, battle.habitat);
  }

  private resetProfiles(): void {
    if (!confirm('Alle gemeinsamen Trainerprofile auf allen Geräten wirklich löschen?')) return;
    this.profiles.clear();
    this.profile = null;
    this.battle = null;
    this.currentPage = 'home';
    this.render();
    this.showGameMessage('Alle Trainerkarten wurden gelöscht.');
  }

  private async connectToSharedGame(): Promise<void> {
    try {
      await this.profiles.connectShared();
      this.profile = this.profiles.active;
      $('#serverWarning').hidden = true;
      this.render();
    } catch (error) {
      console.error('Gemeinsamer Spielstand ist nicht erreichbar.', error);
      $('#serverWarning').hidden = false;
    }
  }

  private async refreshTrainerList(): Promise<void> {
    try {
      await this.profiles.refreshShared(false);
      this.profile = this.profiles.active;
      $('#serverWarning').hidden = true;
      this.render();
    } catch (error) {
      console.error('Trainerliste konnte nicht aktualisiert werden.', error);
      $('#serverWarning').hidden = false;
    }
  }

  private render(): void {
    const profile = this.profile;
    const choosing = !profile;
    $('#profilePicker').classList.toggle('hidden', !choosing);
    $('#setup').classList.toggle('hidden', choosing || !!profile?.name);
    $('#game').classList.toggle('hidden', choosing || !profile?.name);
    $('#start').classList.toggle('hidden', !!profile?.name);
    $('#switchTrainer').classList.toggle('hidden', this.profiles.all.length === 0);
    $('#starterChoices').innerHTML = STARTER_IDS.map(id => {
      const pokemon = POKEMON[id];
      const selected = profile?.starter === id ? 'selected' : '';
      return `<button class="starter-choice ${pokemon.color} ${selected}" data-starter="${id}" type="button"><span class="choice-emoji"><img src="assets/sprites/${id}.png" alt=""></span><strong>${pokemon.name}</strong><small>${pokemon.types.join(' · ')}</small></button>`;
    }).join('');
    if (choosing) {
      this.renderProfileButtons('#profileList');
      return;
    }
    this.input('#trainerName').value = profile.name;
    $('#beginButton').toggleAttribute('disabled', !this.canBegin());
    if (!profile.name) return;

    $('#trainerDisplay').textContent = `Hallo, ${profile.name}!`;
    $('#teamSummary').textContent = `${profile.collection.length} Pokémon · ${profile.livingPokemon().length} fit`;
    $('#dexEntryCount').textContent = String(profile.collection.length).padStart(2, '0');
    $('#badgeCount').textContent = String(profile.badges.length);
    this.pokedexView.renderCollection(profile);
    $('#badges').innerHTML = BADGES.map(badge => {
      const earned = profile.badges.includes(badge.id);
      return `<div class="badge ${earned ? 'earned' : ''}"><span>${earned ? badge.emoji : '🔒'}</span><div><strong>${badge.name}</strong><small>${earned ? 'Prüfung bestanden' : badge.task}</small></div></div>`;
    }).join('');
    this.updatePageVisibility();
  }

  private showPage(page: AppPage): void {
    this.currentPage = page;
    this.updatePageVisibility();
  }

  /** Zeigt immer genau einen Bereich: Startmenü oder die ausgewählte Unterseite. */
  private updatePageVisibility(): void {
    document.body.classList.toggle('page-open', this.currentPage !== 'home');
    $('#mainMenu').classList.toggle('hidden', this.currentPage !== 'home');
    $('#trainerGreetingStrip').classList.toggle('hidden', this.currentPage !== 'home');
    for (const [page, selector] of PAGE_SECTIONS) {
      $(selector).classList.toggle('hidden', this.currentPage !== page);
    }
  }

  /** Übergibt den aktuellen Kampfzustand an die reine Darstellungsklasse. */
  private renderBattle(message: string, effect: BattleEffect = '', damage: number | null = null, moveType: PokemonType | null = null): void {
    if (!this.battle || !this.profile) return;
    this.battleView.render($('#battleContent'), this.battle, this.profile, message, this.turnLocked, effect, damage, moveType);
  }
  private renderProfileButtons(target: string): void {
    $(target).innerHTML = this.profiles.all.map(profile => `<button class="profile-choice" data-profile="${profile.id}" type="button">
      <span>🧢</span><strong>${this.escape(profile.name || 'Neues Profil')}</strong>
      <small>${profile.collection.length} Pokémon · ${profile.badges.length} Orden</small></button>`).join('')
      || '<p class="empty-state">Noch keine Trainerprofile angelegt.</p>';
  }

  private escape(value: string): string {
    const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return value.replace(/[&<>"']/g, character => entities[character] ?? character);
  }

  private input(selector: string): HTMLInputElement {
    return $(selector) as HTMLInputElement;
  }

  private form(selector: string): HTMLFormElement {
    return $(selector) as HTMLFormElement;
  }

  private dialog(selector: string): HTMLDialogElement {
    return $(selector) as HTMLDialogElement;
  }

  private showGameMessage(message: string): void {
    this.messages.show(message);
  }
}

/** Holt im Vite-Entwicklungsmodus eine alte HTML-Seite aus dem Service-Worker-Cache ein. */
async function reloadStaleDevelopmentPage(): Promise<boolean> {
  if (import.meta.env.PROD || document.querySelector('#encounterContent')) return false;
  const reloadKey = 'entdeckertour-dev-refresh-v1';
  if (sessionStorage.getItem(reloadKey)) return false;
  sessionStorage.setItem(reloadKey, 'done');
  const appScope = new URL('./', location.href).href;
  const registrations = await navigator.serviceWorker?.getRegistrations() ?? [];
  await Promise.all(registrations.filter(item => item.scope === appScope).map(item => item.unregister()));
  if ('caches' in window) {
    const oldCaches = (await window.caches.keys()).filter(key => key.startsWith('entdeckertour-'));
    await Promise.all(oldCaches.map(key => window.caches.delete(key)));
  }
  // Eine einmalige Cache-Busting-Adresse holt die aktuelle index.html.
  const freshUrl = new URL(location.href);
  freshUrl.searchParams.set('__app_refresh', '1');
  location.replace(freshUrl.href);
  return true;
}

void reloadStaleDevelopmentPage().then(reloading => {
  if (reloading) return;
  if (document.querySelector('#encounterContent')) {
    new EntdeckertourApp();
    return;
  }
  const warning = document.createElement('div');
  warning.className = 'file-warning';
  warning.textContent = 'App-Dateien passen nicht zusammen. Bitte den Server neu starten und die Seite einmal aktualisieren.';
  document.body.prepend(warning);
});

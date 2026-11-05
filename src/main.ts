import { POKEMON, STARTER_IDS } from './data/pokemon';
import { BADGES, HEAL_CODE, WILD_TOKEN_CODES, WILD_TOKEN_HABITATS } from './data/settings';
import type { EncounterHabitat } from './domain/types';
import { Battle } from './game/Battle';
import { ProfileRepository } from './game/ProfileRepository';
import { TypeChart } from './game/TypeChart';
import { TrainerProfile } from './game/TrainerProfile';

const $ = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Element fehlt in index.html: ${selector}`);
  return element;
};

type BattleEffect = 'trainer' | 'wild' | '';
type AppPage = 'home' | 'pokemon' | 'found' | 'center' | 'badges';

/**
 * Die App-Klasse verbindet Oberfläche und Spielregeln.
 * Pokémon-Daten, Profile und Kämpfe liegen in eigenen Klassen/Dateien.
 */
class EntdeckertourApp {
  private readonly profiles = new ProfileRepository();
  private profile: TrainerProfile | null = this.profiles.active;
  private battle: Battle | null = null;
  private encounterPokemonId = '';
  private currentEncounterHabitat: EncounterHabitat = 'meadow';
  private currentCry: HTMLAudioElement | null = null;
  private returnToEncounter = false;
  private returnPageAfterDex: AppPage = 'found';
  private turnLocked = false;
  private currentPage: AppPage = 'home';
  private dexLoadTimers: number[] = [];

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
      const page = button?.dataset.openPage as AppPage | undefined;
      if (page && page !== 'home') this.navigateTo(page);
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
    this.playGrassTransition(pokemonId, () => {
      this.renderEncounterChoice(pokemonId);
      this.dialog('#encounterDialog').showModal();
    });
  }

  private navigateTo(page: AppPage): void {
    if (page === 'found') {
      this.playGrassTransition(null, () => this.showPage('found'));
      return;
    }
    if (page === 'pokemon') {
      this.showDexList();
      this.showPage(page);
      this.animatePokedexOpening();
      return;
    }
    this.showPage(page);
  }

  private animatePokedexOpening(): void {
    const device = $('#pokedexDevice');
    const screen = $('.dex-screen-frame');
    const loading = $('#dexLoading');
    const bar = $('#dexLoadingBar');
    this.dexLoadTimers.forEach(timer => window.clearTimeout(timer));
    this.dexLoadTimers = [];

    device.classList.remove('appearing');
    void device.offsetWidth;
    device.classList.add('appearing');
    screen.classList.add('dex-loading');
    $('#collection').classList.remove('entries-loaded');
    loading.classList.remove('hidden');
    bar.style.width = '0%';
    $('#dexLoadingPercent').textContent = '00%';
    $('#dexLoadingText').textContent = 'POKÉDEX WIRD GELADEN';

    const progress = [
      { percent: 24, text: 'TRAINERDATEN PRÜFEN' },
      { percent: 53, text: 'TEAM WIRD GESUCHT' },
      { percent: 81, text: 'POKÉMON SPRITES LADEN' },
      { percent: 100, text: 'POKÉDEX BEREIT!' },
    ];
    progress.forEach((step, index) => {
      this.dexLoadTimers.push(window.setTimeout(() => {
        bar.style.width = `${step.percent}%`;
        $('#dexLoadingPercent').textContent = `${String(step.percent).padStart(2, '0')}%`;
        $('#dexLoadingText').textContent = step.text;
        if (index === progress.length - 1) {
          this.dexLoadTimers.push(window.setTimeout(() => {
            loading.classList.add('hidden');
            screen.classList.remove('dex-loading');
            $('#collection').classList.add('entries-loaded');
            device.classList.remove('appearing');
          }, 320));
        }
      }, 260 * (index + 1)));
    });
  }

  /** Kurze, klassische Grasraschel-Szene vor der Fundseite oder einer wilden Begegnung. */
  private playGrassTransition(pokemonId: string | null, onComplete: () => void): void {
    const overlay = $('#grassTransition');
    const sprite = $('#grassPokemon');
    overlay.classList.remove('hidden', 'fade-out', 'flash', 'rustling');
    overlay.setAttribute('aria-hidden', 'false');
    sprite.innerHTML = pokemonId ? `<img src="assets/sprites/${pokemonId}-front.gif" alt="">` : '';
    $('#grassMessage').textContent = pokemonId ? 'Das hohe Gras raschelt …' : 'Du gehst durch das hohe Gras …';
    requestAnimationFrame(() => overlay.classList.add('rustling'));
    window.setTimeout(() => {
      overlay.classList.add('flash');
      $('#grassMessage').textContent = pokemonId
        ? `Ein wildes ${POKEMON[pokemonId].name} taucht auf!`
        : 'Hier könnte sich ein Pokémon verstecken!';
      if (pokemonId) this.playPokemonCry(pokemonId);
    }, 520);
    window.setTimeout(() => {
      overlay.classList.add('fade-out');
      window.setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.setAttribute('aria-hidden', 'true');
        onComplete();
      }, 230);
    }, 1030);
  }

  /** Spielt den lokalen PokéAPI-Ruf ab, sobald das wilde Pokémon erscheint. */
  private playPokemonCry(pokemonId: string): void {
    const pokemon = POKEMON[pokemonId];
    if (!pokemon) return;
    this.currentCry?.pause();
    const cry = new Audio(`assets/cries/${pokemon.dexNumber}.ogg`);
    cry.volume = 0.55;
    this.currentCry = cry;
    void cry.play().catch(() => {
      // Der Fund bleibt spielbar, falls ein Gerät Audio blockiert oder stumm ist.
    });
  }

  private beginBattle(pokemonId: string): void {
    this.encounterPokemonId = pokemonId;
    this.playPokemonCry(pokemonId);
    if (this.returnToEncounter) {
      this.showDexList();
      this.showPage(this.returnPageAfterDex);
    }
    this.dialog('#encounterDialog').close();
    this.battle = new Battle(this.profile!, pokemonId, this.currentEncounterHabitat);
    this.turnLocked = false;
    this.renderBattle('Ein wildes Pokémon taucht auf!');
    this.dialog('#battleDialog').showModal();
  }

  private openPokedex(pokemonId: string, returnToEncounter: boolean, slideDirection?: 'previous' | 'next'): void {
    const pokemon = POKEMON[pokemonId];
    if (!pokemon) return;
    // Der Tap auf einen Pokédex-Eintrag ist eine direkte Nutzeraktion, sodass
    // mobile Browser den Ruf zuverlässig abspielen dürfen.
    this.playPokemonCry(pokemonId);
    this.encounterPokemonId = pokemonId;
    this.returnToEncounter = returnToEncounter;
    this.returnPageAfterDex = this.currentPage;
    if (returnToEncounter) this.dialog('#encounterDialog').close();
    this.showPage('pokemon');
    $('#pokedexListView').classList.add('hidden');
    $('#pokedexDetailView').classList.remove('hidden');
    this.renderPokedex(pokemonId, true);
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

  private renderPokedex(pokemonId: string, playMotion = false): void {
    const pokemon = POKEMON[pokemonId];
    const types = pokemon.types.map(type => `<span class="type-chip ${this.typeClass(type)}">${type}</span>`).join('');
    const moves = pokemon.moves.map(move => {
      const moveType = move.type
        ? `<span class="type-chip ${this.typeClass(move.type)}">${move.type}</span>`
        : '<span class="type-chip type-tactic">Taktik</span>';
      const detail = move.effect === 'evade' ? 'Weicht dem nächsten Angriff aus' : `Basisstärke ${move.power}`;
      return `<div class="pokedex-move"><div><strong>${move.name}</strong><small>${detail}</small></div>${moveType}</div>`;
    }).join('');
    const backLabel = this.returnToEncounter ? '← Zurück zur Begegnung' : '← Zur Pokémon-Liste';
    const actions = this.returnToEncounter ? '<div class="pokedex-actions"><button class="primary-button" data-pokedex-action="fight" type="button">Kampf starten ⚔️</button></div>' : '';
    const team = this.profile?.collection ?? [];
    const teamIndex = team.indexOf(pokemonId);
    const habitat = this.returnToEncounter
      ? this.currentEncounterHabitat
      : this.profile?.habitatOf(pokemonId) ?? 'meadow';
    const motionClass = playMotion ? `dex-motion-${pokemonId}` : '';
    const teamNavigation = !this.returnToEncounter && teamIndex >= 0
      ? `<nav class="dex-team-nav" aria-label="Pokémon im Team"><button class="dex-team-button" data-pokedex-action="previous" type="button" aria-label="Vorheriges Pokémon" ${teamIndex === 0 ? 'disabled' : ''}>◀ Zurück</button><span>${teamIndex + 1} / ${team.length}</span><button class="dex-team-button" data-pokedex-action="next" type="button" aria-label="Nächstes Pokémon" ${teamIndex === team.length - 1 ? 'disabled' : ''}>Weiter ▶</button></nav>`
      : '';
    $('#pokedexContent').innerHTML = `<div class="dex-detail-content"><div class="pokedex-topline"><button class="dex-detail-back" data-pokedex-action="back" type="button">${backLabel}</button><strong>Nr. ${String(pokemon.dexNumber).padStart(4, '0')}</strong></div>
      ${teamNavigation}
      <div class="pokedex-hero ${pokemon.color} ${motionClass} habitat-${habitat}"><img src="assets/sprites/${pokemonId}.png" alt="${pokemon.name}"></div>
      <div class="pokedex-title"><div><h2>${pokemon.name}</h2><span>${pokemon.category}</span></div><div class="pokedex-types">${types}</div></div>
      <p class="pokedex-description">${pokemon.description}</p>
      <div class="pokedex-facts"><div><small>GRÖSSE</small><strong>${pokemon.height}</strong></div><div><small>GEWICHT</small><strong>${pokemon.weight}</strong></div></div>
      <section class="pokedex-moves"><div class="moves-heading"><h3>Attacken</h3><small>Typ und Basisstärke</small></div><div class="pokedex-move-list">${moves}</div></section>
      ${actions}</div>`;
  }

  private typeClass(type: string): string {
    const names: Record<string, string> = { Elektro: 'electric', Feuer: 'fire', Wasser: 'water', Pflanze: 'grass', Käfer: 'bug', Fee: 'fairy', Gift: 'poison', Flug: 'flying', Unlicht: 'dark', Normal: 'normal' };
    return `type-${names[type] ?? 'normal'}`;
  }

  private healTeam(code: string): void {
    if (!this.profile) return;
    if (code !== HEAL_CODE) return this.showGameMessage('Der Heilcode stimmt nicht. Frag eine erwachsene Person.');
    this.profile.healAll();
    this.profiles.save();
    this.input('#healCode').value = '';
    this.render();
    this.showGameMessage('Dein ganzes Team ist wieder fit!');
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
    this.turnLocked = true;
    const action = battle.trainerAttack(index);
    this.profiles.save();
    const effectiveness = TypeChart.describe(action.effectiveness);
    const damageText = action.damage ? `${action.damage} KP Schaden. ` : '';
    const actionText = action.specialEffect === 'evade'
      ? `${action.attackerName} macht sich zum Ausweichen bereit! Der nächste Treffer kann verfehlen.`
      : `${action.attackerName} setzt ${action.moveName} ein! ${damageText}${effectiveness}`;
    this.renderBattle(actionText, 'trainer', action.damage, battle.activePokemon.moves[index]?.type ?? null);
    if (String(battle.result) === 'win') {
      window.setTimeout(() => {
        if (this.battle !== battle) return;
        this.renderBattle(`Das wilde ${battle.opponent.name} wurde besiegt!`);
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
    const moveType = battle.opponent.moves.find(move => move.name === action.moveName)?.type ?? null;
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
    // Direkt den neuen Pokédex-Eintrag zeigen: Das ist der sichtbare Fang-Moment.
    this.openPokedex(pokemon.id, false);
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
    $('#collection').innerHTML = profile.collection.map((id, index) => this.pokemonCard(id, index)).join('')
      || '<div class="empty-state">Dein Team wartet auf das erste gefangene Pokémon. 🌟</div>';
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
    $('#mainMenu').classList.toggle('hidden', this.currentPage !== 'home');
    $('#trainerGreetingStrip').classList.toggle('hidden', this.currentPage !== 'home');
    const pages: Record<Exclude<AppPage, 'home'>, string> = {
      pokemon: '#pokemonPage', found: '#foundPage', center: '#centerPage', badges: '#badgesPage',
    };
    for (const [page, selector] of Object.entries(pages) as [Exclude<AppPage, 'home'>, string][]) {
      $(selector).classList.toggle('hidden', this.currentPage !== page);
    }
  }

  private pokemonCard(id: string, index: number): string {
    const pokemon = POKEMON[id];
    if (!pokemon || !this.profile) return '';
    const hp = this.profile.hpOf(id);
    const active = id === this.profile.activePokemonId;
    const number = String(pokemon.dexNumber).padStart(3, '0');
    return `<button class="dex-entry ${pokemon.color} ${active ? 'active-entry' : ''}" style="--entry-index:${index}" data-pokemon="${id}" type="button" aria-label="Pokédex-Eintrag für ${pokemon.name} öffnen">
      <span class="dex-number">${number}</span><span class="dex-entry-sprite"><img src="assets/sprites/${id}.png" alt=""></span>
      <span class="dex-entry-data"><strong>${pokemon.name}</strong><small>${pokemon.types.join(' / ')} · KP ${hp}/${pokemon.maxHp}</small></span>
      <span class="dex-entry-mark">${active ? '★' : '›'}</span></button>`;
  }

  private renderBattle(message: string, effect: BattleEffect = '', damage: number | null = null, moveType: string | null = null): void {
    const battle = this.battle;
    const profile = this.profile;
    if (!battle || !profile) return;
    const mine = battle.activePokemon;
    const wild = battle.opponent;
    const replacementMode = battle.needsReplacement;
    const typeClass: Record<string, string> = { Elektro: 'electric', Feuer: 'fire', Wasser: 'water', Pflanze: 'grass', Eis: 'ice', Kampf: 'fighting', Gift: 'poison', Boden: 'ground', Flug: 'flying', Psycho: 'psychic', Käfer: 'bug', Gestein: 'rock', Geist: 'ghost', Drache: 'dragon', Unlicht: 'dark', Stahl: 'steel', Fee: 'fairy', Normal: 'normal' };
    const moves = replacementMode || battle.result !== 'playing' ? '' : mine.moves.map((move, index) => {
      const multiplier = TypeChart.multiplier(move.type, wild.types);
      const effectText = multiplier > 1 ? ' · sehr effektiv' : multiplier < 1 ? ' · wenig effektiv' : '';
      const moveDetail = move.effect === 'evade' ? 'Taktik · weicht aus' : `${move.type} · Stärke ${move.power}${effectText}`;
      return `<button class="move-button" data-move="${index}" type="button" ${this.turnLocked ? 'disabled' : ''}>
        <strong>${move.name}</strong><small>${moveDetail}</small></button>`;
    }).join('');
    const roster = profile.collection.map(id => {
      const pokemon = POKEMON[id];
      const isActive = id === profile.activePokemonId;
      const hp = profile.hpOf(id);
      const canSwitch = hp > 0 && !isActive && (replacementMode || !this.turnLocked);
      return `<button class="battle-roster-choice ${isActive ? 'current' : ''}" data-switch-pokemon="${id}" type="button" ${canSwitch ? '' : 'disabled'}>
        <img src="assets/sprites/${id}.png" alt=""><span>${pokemon.name}<small>KP ${hp}/${pokemon.maxHp}</small></span>${isActive ? '<b>Im Einsatz</b>' : ''}</button>`;
    }).join('');
    let outcome = '';
    if (battle.result === 'lose') outcome = '<p class="battle-message defeat-message">Dein Team ist erschöpft. Geh zum Pokémon-Center und hol dir neue Kraft.</p><button id="closeBattleButton" class="primary-button full">Zum Pokémon-Center gehen</button>';
    else if (replacementMode) outcome = '<p class="battle-message">Dein Pokémon ist K.O. Such ein anderes aus, Trainer!</p>';
    const effectMarkup = effect && damage !== null && damage > 0
      ? `<div class="attack-effect type-${typeClass[moveType ?? 'Normal'] ?? 'normal'} ${effect === 'trainer' ? 'from-trainer' : 'from-wild'}" aria-hidden="true"><i></i><i></i><i></i></div>`
      : '';
    $('#battleContent').innerHTML = `<div class="battle-heading"><span>WILDE BEGEGNUNG</span><h2>Ein wildes ${wild.name}!</h2></div>
      <div class="battlefield habitat-${battle.habitat} ${effect ? `turn-${effect}` : ''}">
        <div class="battle-platform platform-wild"></div><div class="battle-platform platform-trainer"></div>
        <div class="battle-status status-wild"><div><strong>${wild.name}</strong><small>${wild.types.join(' · ')}</small></div><div class="status-hp"><span>KP</span><i><b style="width:${Math.max(0, battle.opponentHp / wild.maxHp * 100)}%"></b></i></div><small>${battle.opponentHp} / ${wild.maxHp}</small></div>
        <div class="battle-status status-trainer"><div><strong>${mine.name}</strong><small>${mine.types.join(' · ')}</small></div><div class="status-hp"><span>KP</span><i><b style="width:${Math.max(0, profile.hpOf(mine.id) / mine.maxHp * 100)}%"></b></i></div><small>${profile.hpOf(mine.id)} / ${mine.maxHp}</small></div>
        <div class="fighter trainer-fighter ${effect === 'wild' ? 'taking-hit' : ''} ${effect === 'trainer' ? 'attacking' : ''}"><span class="fighter-art"><img class="battle-sprite" src="assets/sprites/${mine.id}-back.gif" alt="${mine.name}"></span>${effect === 'wild' && damage !== null && damage > 0 ? `<b class="damage-float">−${damage}</b>` : ''}</div>
        <div class="fighter wild-fighter ${effect === 'trainer' ? 'taking-hit' : ''} ${effect === 'wild' ? 'attacking' : ''}"><span class="fighter-art"><img class="battle-sprite" src="assets/sprites/${wild.id}-front.gif" alt="${wild.name}"></span>${effect === 'trainer' && damage !== null && damage > 0 ? `<b class="damage-float">−${damage}</b>` : ''}</div>
        ${effectMarkup}
      </div>
      <section class="battle-command"><p class="battle-message">${message}</p><div class="move-grid">${moves}</div></section>
      <div class="battle-roster"><strong>Team wechseln</strong>${roster}</div>${outcome}`;
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
    $('#gameMessageText').textContent = message;
    const dialog = this.dialog('#messageDialog');
    if (!dialog.open) dialog.showModal();
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

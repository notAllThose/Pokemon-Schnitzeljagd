import { POKEMON } from '../data/pokemon';
import { AudioManager } from './AudioManager';
import { getElement } from './dom';

type CenterScene = 'enter' | 'heal';

/** Steuert die dekorativen Szenen und Übergänge der Spieloberfläche. */
export class SceneAnimator {
  private dexLoadTimers: number[] = [];

  constructor(private readonly audio: AudioManager) {}

  /** Schwarzblende über die alte Seite, Seitenwechsel darunter, weiches Einblenden. */
  playPageTransition(onCovered: () => void, onReveal: () => void, onComplete: () => void): void {
    const overlay = getElement('#pageTransition');
    overlay.classList.remove('hidden', 'page-transition-active');
    overlay.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => overlay.classList.add('page-transition-active'));

    // Die Seite wird gewechselt, während die Blende den alten Inhalt verdeckt.
    window.setTimeout(onCovered, 260);
    // Sobald sich der Vorhang öffnet, kann der neue Inhalt weich einblenden.
    window.setTimeout(onReveal, 440);
    window.setTimeout(() => {
      overlay.classList.add('hidden');
      overlay.classList.remove('page-transition-active');
      overlay.setAttribute('aria-hidden', 'true');
      onComplete();
    }, 760);
  }

  /** Öffnet das Pokémon-Center bzw. spielt dessen Heilungssequenz ab. */
  playCenterTransition(scene: CenterScene, onComplete: () => void): void {
    const overlay = getElement('#centerTransition');
    overlay.classList.remove('hidden', 'center-entering', 'center-healing', 'center-fade');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.add(scene === 'enter' ? 'center-entering' : 'center-healing');
    getElement('#centerSceneMessage').textContent = scene === 'enter'
      ? 'Pokémon-Center'
      : 'Deine Pokémon werden geheilt!';
    if (scene === 'heal') this.audio.playHealingJingle();

    const fadeAt = scene === 'enter' ? 1250 : 2450;
    const finishAt = scene === 'enter' ? 1570 : 2770;
    window.setTimeout(() => overlay.classList.add('center-fade'), fadeAt);
    window.setTimeout(() => {
      overlay.classList.add('hidden');
      overlay.setAttribute('aria-hidden', 'true');
      overlay.classList.remove('center-entering', 'center-healing', 'center-fade');
      onComplete();
    }, finishAt);
  }

  /** Lädt den Pokédex mit der animierten Retro-Fortschrittsanzeige. */
  animatePokedexOpening(): void {
    const screen = getElement('.dex-screen-frame');
    const loading = getElement('#dexLoading');
    const bar = getElement('#dexLoadingBar') as HTMLElement;
    this.clearDexTimers();

    screen.classList.add('dex-loading');
    getElement('#collection').classList.remove('entries-loaded');
    loading.classList.remove('hidden');
    bar.style.width = '0%';
    getElement('#dexLoadingPercent').textContent = '00%';
    getElement('#dexLoadingText').textContent = 'POKÉDEX WIRD GELADEN';

    const steps = [
      { percent: 24, label: 'TRAINERDATEN PRÜFEN' },
      { percent: 53, label: 'TEAM WIRD GESUCHT' },
      { percent: 81, label: 'POKÉMON SPRITES LADEN' },
      { percent: 100, label: 'POKÉDEX BEREIT!' },
    ];
    steps.forEach((step, index) => {
      this.dexLoadTimers.push(window.setTimeout(() => {
        bar.style.width = `${step.percent}%`;
        getElement('#dexLoadingPercent').textContent = `${String(step.percent).padStart(2, '0')}%`;
        getElement('#dexLoadingText').textContent = step.label;
        if (index === steps.length - 1) {
          this.dexLoadTimers.push(window.setTimeout(() => {
            loading.classList.add('hidden');
            screen.classList.remove('dex-loading');
            getElement('#collection').classList.add('entries-loaded');
          }, 320));
        }
      }, 260 * (index + 1)));
    });
  }

  /** Raschelt das Gras beim Öffnen oder lässt ein gefundenes Pokémon auftauchen. */
  playGrassTransition(pokemonId: string | null, onComplete: () => void): void {
    const overlay = getElement('#grassTransition');
    const sprite = getElement('#grassPokemon');
    overlay.classList.remove('hidden', 'fade-out', 'flash', 'rustling');
    overlay.setAttribute('aria-hidden', 'false');
    sprite.innerHTML = pokemonId ? `<img src="assets/sprites/${pokemonId}-front.gif" alt="">` : '';
    getElement('#grassMessage').textContent = pokemonId
      ? 'Das hohe Gras raschelt …'
      : 'Das Gras raschelt …';
    this.audio.playGrassRustle();
    requestAnimationFrame(() => overlay.classList.add('rustling'));

    if (pokemonId) {
      window.setTimeout(() => {
        overlay.classList.add('flash');
        getElement('#grassMessage').textContent = `Ein wildes ${POKEMON[pokemonId].name} taucht auf!`;
        this.audio.playPokemonCry(pokemonId);
      }, 520);
    }

    const sceneDuration = pokemonId ? 1030 : 850;
    window.setTimeout(() => {
      overlay.classList.add('fade-out');
      window.setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.setAttribute('aria-hidden', 'true');
        onComplete();
      }, 230);
    }, sceneDuration);
  }

  private clearDexTimers(): void {
    this.dexLoadTimers.forEach(timer => window.clearTimeout(timer));
    this.dexLoadTimers = [];
  }
}


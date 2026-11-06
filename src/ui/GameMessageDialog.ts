import type { EncounterHabitat, PokemonDefinition } from '../domain/types';
import { AudioManager } from './AudioManager';
import { getElement } from './dom';

/** Gemeinsames Nachrichtenfenster für kurze Spieltexte und Pokémon-Fänge. */
export class GameMessageDialog {
  private captureTimer: number | null = null;

  constructor(private readonly audio: AudioManager) {
    this.dialog.addEventListener('close', () => this.resetCaptureScene());
    this.dialog.addEventListener('cancel', event => {
      // Die Fangsequenz soll nicht versehentlich per Escape abgebrochen werden.
      if (this.captureTimer !== null) event.preventDefault();
    });
  }

  show(message: string): void {
    this.clearCaptureTimer();
    this.resetCaptureScene();
    this.messageElement.textContent = message;
    if (!this.dialog.open) this.dialog.showModal();
  }

  /** Spielt den Fang im Nachrichtenfenster ab und zeigt erst danach den Erfolgstext. */
  showCapture(pokemon: PokemonDefinition, habitat: EncounterHabitat): void {
    this.clearCaptureTimer();
    const scene = getElement('#captureScene');
    const sprite = getElement('#capturePokemonSprite') as HTMLImageElement;
    sprite.src = `assets/sprites/${pokemon.id}-front.gif`;
    sprite.alt = pokemon.name;
    scene.style.backgroundImage = `linear-gradient(#10203055,#10203055),url("assets/backgrounds/${habitat}.png")`;
    scene.style.backgroundSize = 'cover';
    scene.style.backgroundPosition = 'center';
    scene.classList.remove('hidden', 'capture-active');
    void scene.offsetWidth;
    scene.classList.add('capture-active');
    scene.setAttribute('aria-hidden', 'false');

    this.messageElement.textContent = `Ein wildes ${pokemon.name} wird gefangen …`;
    this.continueButton.disabled = true;
    if (!this.dialog.open) this.dialog.showModal();
    this.audio.playCaptureSound();

    this.captureTimer = window.setTimeout(() => {
      this.messageElement.textContent = `Klasse! ${pokemon.name} wurde deiner Sammlung hinzugefügt!`;
      this.continueButton.disabled = false;
      this.captureTimer = null;
    }, 2550);
  }

  private get dialog(): HTMLDialogElement { return getElement('#messageDialog'); }
  private get messageElement(): HTMLElement { return getElement('#gameMessageText'); }
  private get continueButton(): HTMLButtonElement { return getElement('#messageContinue'); }
  private clearCaptureTimer(): void {
    if (this.captureTimer !== null) window.clearTimeout(this.captureTimer);
    this.captureTimer = null;
  }

  private resetCaptureScene(): void {
    this.clearCaptureTimer();
    const scene = getElement('#captureScene');
    scene.classList.add('hidden');
    scene.classList.remove('capture-active');
    scene.style.backgroundImage = '';
    scene.setAttribute('aria-hidden', 'true');
    this.continueButton.disabled = false;
  }
}


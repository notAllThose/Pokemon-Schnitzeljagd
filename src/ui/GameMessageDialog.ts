import type { EncounterHabitat, Move, PokemonDefinition } from '../domain/types';
import { AudioManager } from './AudioManager';
import { getElement } from './dom';

/** Gemeinsames Nachrichtenfenster für kurze Spieltexte und Pokémon-Fänge. */
export class GameMessageDialog {
  private captureTimer: number | null = null;
  private moveChoiceHandler: ((forgetIndex: number | null | 'decline') => void) | null = null;
  private learningContext: { pokemon: PokemonDefinition; move: Move; knownMoves: Move[] } | null = null;

  constructor(private readonly audio: AudioManager) {
    this.dialog.addEventListener('close', () => this.resetCaptureScene());
    this.choiceContainer.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-move-choice]');
      if (!button) return;
      const choice = button.dataset.moveChoice;
      if (choice === 'start-learning') {
        const context = this.learningContext;
        if (!context) return;
        if (context.knownMoves.length < 4) {
          this.finishMoveChoice(null);
        } else {
          this.renderForgetChoices();
        }
        return;
      }
      if (choice === 'back-to-prompt') {
        this.renderLearningPrompt();
        return;
      }
      if (choice === 'confirm-cancel') {
        this.finishMoveChoice('decline');
        return;
      }
      if (choice === 'confirm-no') {
        this.renderForgetChoices();
        return;
      }
      if (choice === 'confirm-yes') {
        const forgetIndex = Number(button.dataset.forgetIndex);
        this.finishMoveChoice(forgetIndex);
        return;
      }
      if (choice === 'cancel') {
        this.finishMoveChoice('decline');
        return;
      }
      const forgetIndex = Number(choice);
      const context = this.learningContext;
      const forgottenMove = context?.knownMoves[forgetIndex];
      if (!context || !forgottenMove) return;
      this.messageElement.textContent = `Soll ${context.pokemon.name} ${forgottenMove.name} vergessen und ${context.move.name} lernen?`;
      this.choiceContainer.innerHTML = `<button class="move-learn-choice special-move-choice" data-move-choice="confirm-yes" data-forget-index="${forgetIndex}" type="button"><strong>Ja, Attacke wechseln</strong></button>
        <button class="move-learn-cancel" data-move-choice="confirm-no" type="button">Andere Attacke wählen</button>
        <button class="move-learn-cancel" data-move-choice="confirm-cancel" type="button">Nein, nicht erlernen</button>`;
    });
    this.dialog.addEventListener('cancel', event => {
      // Die Fangsequenz soll nicht versehentlich per Escape abgebrochen werden.
      if (this.captureTimer !== null) event.preventDefault();
      else if (this.moveChoiceHandler) this.resetChoices();
    });
  }

  show(message: string): void {
    this.clearCaptureTimer();
    this.resetCaptureScene();
    this.resetChoices();
    this.header.textContent = 'POKÉMON-ABENTEUER';
    this.messageElement.textContent = message;
    if (!this.dialog.open) this.dialog.showModal();
  }

  /** Zeigt im Stil eines Spieltextfensters die Attacken-Auswahl zum Erlernen. */
  showMoveLearning(
    pokemon: PokemonDefinition,
    move: Move,
    knownMoves: Move[],
    onChoose: (forgetIndex: number | null | 'decline') => void,
  ): void {
    this.clearCaptureTimer();
    this.resetCaptureScene();
    this.resetChoices();
    this.moveChoiceHandler = onChoose;
    this.learningContext = { pokemon, move, knownMoves };
    this.header.textContent = 'THEOS ATTACKEN-LEHRER';
    this.renderLearningPrompt();
    if (!this.dialog.open) this.dialog.showModal();
  }

  /** Spielt den Fang im Nachrichtenfenster ab und zeigt erst danach den Erfolgstext. */
  showCapture(pokemon: PokemonDefinition, habitat: EncounterHabitat): void {
    this.clearCaptureTimer();
    this.resetChoices();
    this.header.textContent = 'POKÉMON-ABENTEUER';
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
  private get header(): HTMLElement { return getElement('#gameMessageHeader'); }
  private get continueButton(): HTMLButtonElement { return getElement('#messageContinue'); }
  private get continueForm(): HTMLFormElement { return this.continueButton.closest('form') as HTMLFormElement; }
  private get choiceContainer(): HTMLElement { return getElement('#gameMessageChoices'); }

  private resetChoices(): void {
    this.moveChoiceHandler = null;
    this.learningContext = null;
    this.choiceContainer.innerHTML = '';
    this.choiceContainer.classList.add('hidden');
    this.continueForm.hidden = false;
  }

  private renderForgetChoices(): void {
    const context = this.learningContext;
    if (!context) return;
    this.messageElement.textContent = `${context.pokemon.name} möchte ${context.move.name} erlernen. Welche Attacke soll es vergessen?`;
    this.choiceContainer.innerHTML = `${this.forgetChoicesMarkup(context.knownMoves)}
      <button class="move-learn-cancel" data-move-choice="back-to-prompt" type="button">Zurück zur Frage</button>`;
  }

  private renderLearningPrompt(): void {
    const context = this.learningContext;
    if (!context) return;
    this.messageElement.textContent = `${context.pokemon.name} möchte ${context.move.name} erlernen. Soll es die Attacke lernen?`;
    this.choiceContainer.classList.remove('hidden');
    this.continueForm.hidden = true;
    this.choiceContainer.innerHTML = `<button class="move-learn-choice special-move-choice" data-move-choice="start-learning" type="button"><strong>Ja, Attacke lernen</strong><small>${context.move.type} · Stärke ${context.move.power}</small></button>
      <button class="move-learn-cancel" data-move-choice="cancel" type="button">Nein, nicht erlernen</button>`;
  }

  private forgetChoicesMarkup(knownMoves: Move[]): string {
    return knownMoves.map((knownMove, index) => `<button class="move-learn-choice" data-move-choice="${index}" type="button"><strong>${knownMove.name}</strong><small>${knownMove.type ?? 'Taktik'} · Stärke ${knownMove.power}</small></button>`).join('');
  }

  private finishMoveChoice(choice: number | null | 'decline'): void {
    const handler = this.moveChoiceHandler;
    this.moveChoiceHandler = null;
    this.dialog.close();
    handler?.(choice);
  }
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


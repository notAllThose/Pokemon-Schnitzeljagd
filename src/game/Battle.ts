import { POKEMON } from '../data/pokemon';
import type { BattleActionResult, EncounterHabitat, Move } from '../domain/types';
import { TypeChart } from './TypeChart';
import { TrainerProfile } from './TrainerProfile';

/** Verwaltet einen Kampf. Die Oberfläche entscheidet nur, wann ein Zug gezeigt wird. */
export class Battle {
  opponentHp: number;
  result: 'playing' | 'win' | 'lose' = 'playing';
  private avoidsNextHit = false;

  constructor(readonly trainer: TrainerProfile, readonly opponentId: string, readonly habitat: EncounterHabitat = 'meadow') {
    this.opponentHp = POKEMON[opponentId].maxHp;
  }

  get opponent() { return POKEMON[this.opponentId]; }
  get activePokemon() { return POKEMON[this.trainer.activePokemonId]; }
  /** Wird nach jeder Aktion neu aus dem Kampfzustand gelesen. */
  get isWon(): boolean { return this.result === 'win'; }
  get activeHp(): number { return this.trainer.hpOf(this.trainer.activePokemonId); }
  get needsReplacement(): boolean { return this.activeHp <= 0 && this.trainer.livingPokemon().length > 0; }

  trainerAttack(moveIndex: number): BattleActionResult {
    const move = this.activePokemon.moves[moveIndex];
    if (move.effect === 'evade') {
      this.avoidsNextHit = true;
      return { attackerName: this.activePokemon.name, moveName: move.name, damage: 0, effectiveness: 1, specialEffect: 'evade' };
    }
    const effectiveness = TypeChart.multiplier(move.type, this.opponent.types);
    const baseDamage = move.power + Math.floor(Math.random() * 4);
    const damage = effectiveness === 0 ? 0 : Math.max(1, Math.round(baseDamage * effectiveness));
    this.opponentHp = Math.max(0, this.opponentHp - damage);
    if (this.opponentHp === 0) this.result = 'win';
    return { attackerName: this.activePokemon.name, moveName: move.name, damage, effectiveness };
  }

  opponentAttack(): BattleActionResult {
    // Einfache Kampf-KI: zufällige Schadensattacke, ohne taktische Typ-Auswahl.
    // Taktiken wie Ausweichen werden übersprungen.
    const attackingMoves = this.opponent.moves.filter((move: Move) => move.type !== null);
    const move = attackingMoves[Math.floor(Math.random() * attackingMoves.length)];
    const effectiveness = TypeChart.multiplier(move.type, this.activePokemon.types);
    const baseDamage = move.power + Math.floor(Math.random() * 3);
    const dodged = this.avoidsNextHit;
    this.avoidsNextHit = false;
    const damage = dodged || effectiveness === 0 ? 0 : Math.max(1, Math.round(baseDamage * effectiveness));
    this.trainer.setHp(this.trainer.activePokemonId, this.activeHp - damage);
    if (this.trainer.livingPokemon().length === 0) this.result = 'lose';
    return { attackerName: this.opponent.name, moveName: move.name, damage, effectiveness, ...(dodged ? { specialEffect: 'dodged' as const } : {}) };
  }

  switchPokemon(pokemonId: string): boolean {
    return this.trainer.switchTo(pokemonId);
  }
}

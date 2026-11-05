import type { PokemonType } from '../domain/types';

/**
 * Vereinfachte klassische Pokémon-Typentabelle.
 * Alles, was hier nicht ausdrücklich steht, ist normal effektiv (×1).
 */
const ADVANTAGES: Partial<Record<PokemonType, PokemonType[]>> = {
  Elektro: ['Wasser', 'Flug'], Feuer: ['Pflanze', 'Käfer', 'Eis', 'Stahl'],
  Wasser: ['Feuer', 'Boden', 'Gestein'], Pflanze: ['Wasser', 'Boden', 'Gestein'],
  Käfer: ['Pflanze', 'Psycho', 'Unlicht'], Fee: ['Kampf', 'Drache', 'Unlicht'],
  Gift: ['Pflanze', 'Fee'], Flug: ['Pflanze', 'Kampf', 'Käfer'],
  Unlicht: ['Psycho', 'Geist'], Boden: ['Elektro', 'Feuer', 'Gift', 'Gestein', 'Stahl'],
  Gestein: ['Feuer', 'Eis', 'Flug', 'Käfer'], Kampf: ['Normal', 'Eis', 'Gestein', 'Unlicht', 'Stahl'],
  Psycho: ['Kampf', 'Gift'], Eis: ['Pflanze', 'Boden', 'Flug', 'Drache'],
  Drache: ['Drache'], Stahl: ['Eis', 'Gestein', 'Fee'], Geist: ['Psycho', 'Geist'],
};
const RESISTANCES: Partial<Record<PokemonType, PokemonType[]>> = {
  Normal: ['Gestein', 'Stahl'], Feuer: ['Feuer', 'Wasser', 'Gestein', 'Drache'],
  Wasser: ['Wasser', 'Pflanze', 'Drache'], Elektro: ['Elektro', 'Pflanze', 'Drache'],
  Pflanze: ['Feuer', 'Pflanze', 'Gift', 'Flug', 'Käfer', 'Drache', 'Stahl'],
  Käfer: ['Feuer', 'Kampf', 'Gift', 'Flug', 'Geist', 'Stahl', 'Fee'],
  Fee: ['Feuer', 'Gift', 'Stahl'], Gift: ['Gift', 'Boden', 'Gestein', 'Geist'],
  Flug: ['Elektro', 'Gestein', 'Stahl'], Unlicht: ['Kampf', 'Unlicht', 'Fee'],
  Boden: ['Pflanze', 'Käfer'], Gestein: ['Kampf', 'Boden', 'Stahl'],
  Kampf: ['Gift', 'Flug', 'Psycho', 'Käfer', 'Fee'], Psycho: ['Psycho', 'Stahl'],
  Eis: ['Feuer', 'Wasser', 'Eis', 'Stahl'], Drache: ['Stahl'], Stahl: ['Feuer', 'Wasser', 'Elektro', 'Stahl'],
  Geist: ['Unlicht'],
};
const IMMUNITIES: Partial<Record<PokemonType, PokemonType[]>> = {
  Normal: ['Geist'], Elektro: ['Boden'], Kampf: ['Geist'], Gift: ['Stahl'],
  Boden: ['Flug'], Psycho: ['Unlicht'], Geist: ['Normal'], Drache: ['Fee'],
};

export class TypeChart {
  /** Duale Typen multiplizieren sich wie im Hauptspiel: z.B. ×2 und ×½ = ×1. */
  static multiplier(moveType: PokemonType | null, defenderTypes: PokemonType[]): number {
    if (!moveType) return 1;
    return defenderTypes.reduce((total, defender) => {
      if (IMMUNITIES[moveType]?.includes(defender)) return total * 0;
      if (ADVANTAGES[moveType]?.includes(defender)) return total * 2;
      if (RESISTANCES[moveType]?.includes(defender)) return total * 0.5;
      return total;
    }, 1);
  }

  static describe(multiplier: number): string {
    if (multiplier === 0) return 'Es hat keine Wirkung!';
    if (multiplier > 1) return 'Sehr effektiv!';
    if (multiplier < 1) return 'Nicht sehr effektiv …';
    return '';
  }
}

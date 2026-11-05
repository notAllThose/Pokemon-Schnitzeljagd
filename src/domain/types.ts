/** Die Typen, die wir für Pokémon und Attacken im Spiel verwenden. */
export type PokemonType =
  | 'Normal' | 'Feuer' | 'Wasser' | 'Elektro' | 'Pflanze' | 'Käfer'
  | 'Fee' | 'Gift' | 'Flug' | 'Unlicht' | 'Boden' | 'Gestein'
  | 'Kampf' | 'Psycho' | 'Eis' | 'Drache' | 'Stahl' | 'Geist';

export interface Move {
  name: string;
  /** null bedeutet: Die Attacke hat keinen Elementtyp. */
  type: PokemonType | null;
  power: number;
  effect?: 'evade';
}

export interface PokemonDefinition {
  id: string;
  name: string;
  dexNumber: number;
  category: string;
  description: string;
  height: string;
  weight: string;
  types: PokemonType[];
  color: string;
  maxHp: number;
  moves: Move[];
}

/** Alles, was zu einem Kind gehört, wird unter diesem Profil gespeichert. */
export interface TrainerSave {
  id: string;
  trainer: string;
  starter: string;
  collection: string[];
  badges: string[];
  activePokemonId: string;
  /** Verbleibende KP je Pokémon; deshalb bleiben Wunden nach Gerätewechsel erhalten. */
  hpByPokemon: Record<string, number>;
}

export interface BattleActionResult {
  attackerName: string;
  moveName: string;
  damage: number;
  effectiveness: number;
  specialEffect?: 'evade' | 'dodged';
}

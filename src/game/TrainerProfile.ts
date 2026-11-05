import { POKEMON } from '../data/pokemon';
import type { TrainerSave } from '../domain/types';

// Wenn ein älterer Spielstand noch keinen Fundort enthält, zeigen wir einen
// passenden Pokémon-Lebensraum. Neue Fänge speichern den echten Token-Fundort.
const DEFAULT_HABITATS: Record<string, TrainerSave['habitatByPokemon'][string]> = {
  pikachu: 'forest', glumanda: 'volcanocave', schiggy: 'river',
  bulbasaur: 'forest', raupy: 'forest', piepi: 'mountain', zubat: 'dampcave',
};
const LEGACY_CAPTURE_HABITATS: Record<string, TrainerSave['habitatByPokemon'][string]> = {
  raupy: 'forest', piepi: 'meadow', zubat: 'dampcave',
};

/** Verhält sich wie die Trainerkarte eines Kindes und verwaltet dessen Team. */
export class TrainerProfile {
  readonly data: TrainerSave;

  constructor(data: Partial<TrainerSave> = {}) {
    this.data = {
      id: data.id ?? `trainer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      trainer: data.trainer ?? '', starter: data.starter ?? '',
      collection: data.collection ?? [], badges: data.badges ?? [],
      activePokemonId: data.activePokemonId ?? data.starter ?? '',
      hpByPokemon: data.hpByPokemon ?? {},
      habitatByPokemon: data.habitatByPokemon ?? {},
    };
    // Alte Spielstände bekommen volle KP, damit das Update niemanden benachteiligt.
    for (const id of this.data.collection) {
      this.data.hpByPokemon[id] ??= POKEMON[id]?.maxHp ?? 0;
      this.data.habitatByPokemon[id] ??= LEGACY_CAPTURE_HABITATS[id] ?? DEFAULT_HABITATS[id] ?? 'meadow';
    }
    if (!this.data.collection.includes(this.data.activePokemonId)) {
      this.data.activePokemonId = this.data.collection[0] ?? this.data.starter;
    }
  }

  get id(): string { return this.data.id; }
  get name(): string { return this.data.trainer; }
  get starter(): string { return this.data.starter; }
  get collection(): string[] { return this.data.collection; }
  get badges(): string[] { return this.data.badges; }
  get activePokemonId(): string { return this.data.activePokemonId; }

  hpOf(pokemonId: string): number {
    return this.data.hpByPokemon[pokemonId] ?? POKEMON[pokemonId]?.maxHp ?? 0;
  }

  habitatOf(pokemonId: string): TrainerSave['habitatByPokemon'][string] {
    return this.data.habitatByPokemon[pokemonId] ?? DEFAULT_HABITATS[pokemonId] ?? 'meadow';
  }

  setHp(pokemonId: string, hp: number): void {
    const definition = POKEMON[pokemonId];
    if (definition) this.data.hpByPokemon[pokemonId] = Math.max(0, Math.min(definition.maxHp, hp));
  }

  addPokemon(pokemonId: string, habitat: TrainerSave['habitatByPokemon'][string] = DEFAULT_HABITATS[pokemonId] ?? 'meadow'): boolean {
    if (!POKEMON[pokemonId] || this.data.collection.includes(pokemonId)) return false;
    this.data.collection.push(pokemonId);
    this.setHp(pokemonId, POKEMON[pokemonId].maxHp);
    this.data.habitatByPokemon[pokemonId] = habitat;
    return true;
  }

  switchTo(pokemonId: string): boolean {
    if (!this.data.collection.includes(pokemonId) || this.hpOf(pokemonId) <= 0) return false;
    this.data.activePokemonId = pokemonId;
    return true;
  }

  livingPokemon(): string[] {
    return this.data.collection.filter(id => this.hpOf(id) > 0);
  }

  healAll(): void {
    for (const id of this.data.collection) this.setHp(id, POKEMON[id]?.maxHp ?? 0);
  }
}

import { POKEMON } from '../data/pokemon';
import type { EncounterHabitat, PokemonType } from '../domain/types';
import { TrainerProfile } from '../game/TrainerProfile';
import { getElement } from './dom';

interface PokedexDetailOptions {
  returnToEncounter: boolean;
  encounterHabitat: EncounterHabitat;
  playMotion: boolean;
}

const TYPE_CLASS: Record<PokemonType, string> = {
  Normal: 'normal', Feuer: 'fire', Wasser: 'water', Elektro: 'electric', Pflanze: 'grass',
  Käfer: 'bug', Fee: 'fairy', Gift: 'poison', Flug: 'flying', Unlicht: 'dark', Boden: 'ground',
  Gestein: 'rock', Kampf: 'fighting', Psycho: 'psychic', Eis: 'ice', Drache: 'dragon',
  Stahl: 'steel', Geist: 'ghost',
};

/** Rendert Teamliste und Detailkarten im Pokédex-Gehäuse. */
export class PokedexView {
  renderCollection(profile: TrainerProfile): void {
    getElement('#collection').innerHTML = profile.collection
      .map((id, index) => this.pokemonCard(id, index, profile)).join('')
      || '<div class="empty-state">Dein Team wartet auf das erste gefangene Pokémon. 🌟</div>';
  }

  renderDetail(pokemonId: string, profile: TrainerProfile | null, options: PokedexDetailOptions): void {
    const pokemon = POKEMON[pokemonId];
    if (!pokemon) return;
    const types = pokemon.types.map(type => `<span class="type-chip ${this.typeClass(type)}">${type}</span>`).join('');
    const moves = pokemon.moves.map(move => {
      const moveType = move.type
        ? `<span class="type-chip ${this.typeClass(move.type)}">${move.type}</span>`
        : '<span class="type-chip type-tactic">Taktik</span>';
      const detail = move.effect === 'evade' ? 'Weicht dem nächsten Angriff aus' : `Basisstärke ${move.power}`;
      return `<div class="pokedex-move"><div><strong>${move.name}</strong><small>${detail}</small></div>${moveType}</div>`;
    }).join('');

    const backLabel = options.returnToEncounter ? '← Zurück zur Begegnung' : '← Zur Pokémon-Liste';
    const actions = options.returnToEncounter
      ? '<div class="pokedex-actions"><button class="primary-button" data-pokedex-action="fight" type="button">Kampf starten ⚔️</button></div>'
      : '';
    const team = profile?.collection ?? [];
    const teamIndex = team.indexOf(pokemonId);
    const teamNavigation = !options.returnToEncounter && teamIndex >= 0
      ? `<nav class="dex-team-nav" aria-label="Pokémon im Team"><button class="dex-team-button" data-pokedex-action="previous" type="button" aria-label="Vorheriges Pokémon" ${teamIndex === 0 ? 'disabled' : ''}>◀ Zurück</button><span>${teamIndex + 1} / ${team.length}</span><button class="dex-team-button" data-pokedex-action="next" type="button" aria-label="Nächstes Pokémon" ${teamIndex === team.length - 1 ? 'disabled' : ''}>Weiter ▶</button></nav>`
      : '';
    const habitat = options.returnToEncounter
      ? options.encounterHabitat
      : profile?.habitatOf(pokemonId) ?? 'meadow';
    const motionClass = options.playMotion ? `dex-motion-${pokemonId}` : '';

    getElement('#pokedexContent').innerHTML = `<div class="dex-detail-content"><div class="pokedex-topline"><button class="dex-detail-back" data-pokedex-action="back" type="button">${backLabel}</button><strong>Nr. ${String(pokemon.dexNumber).padStart(4, '0')}</strong></div>
      ${teamNavigation}
      <div class="pokedex-hero ${pokemon.color} ${motionClass} habitat-${habitat}"><img src="assets/sprites/${pokemonId}.png" alt="${pokemon.name}"></div>
      <div class="pokedex-title"><div><h2>${pokemon.name}</h2><span>${pokemon.category}</span></div><div class="pokedex-types">${types}</div></div>
      <p class="pokedex-description">${pokemon.description}</p>
      <div class="pokedex-facts"><div><small>GRÖSSE</small><strong>${pokemon.height}</strong></div><div><small>GEWICHT</small><strong>${pokemon.weight}</strong></div></div>
      <section class="pokedex-moves"><div class="moves-heading"><h3>Attacken</h3><small>Typ und Basisstärke</small></div><div class="pokedex-move-list">${moves}</div></section>
      ${actions}</div>`;
  }

  private pokemonCard(id: string, index: number, profile: TrainerProfile): string {
    const pokemon = POKEMON[id];
    if (!pokemon) return '';
    const hp = profile.hpOf(id);
    const active = id === profile.activePokemonId;
    const number = String(pokemon.dexNumber).padStart(3, '0');
    return `<button class="dex-entry ${pokemon.color} ${active ? 'active-entry' : ''}" style="--entry-index:${index}" data-pokemon="${id}" type="button" aria-label="Pokédex-Eintrag für ${pokemon.name} öffnen">
      <span class="dex-number">${number}</span><span class="dex-entry-sprite"><img src="assets/sprites/${id}.png" alt=""></span>
      <span class="dex-entry-data"><strong>${pokemon.name}</strong><small>${pokemon.types.join(' / ')} · KP ${hp}/${pokemon.maxHp}</small></span>
      <span class="dex-entry-mark">${active ? '★' : '›'}</span></button>`;
  }

  private typeClass(type: PokemonType): string {
    return `type-${TYPE_CLASS[type]}`;
  }
}


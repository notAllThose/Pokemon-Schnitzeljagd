import { POKEMON } from '../data/pokemon';
import type { PokemonType } from '../domain/types';
import { Battle } from '../game/Battle';
import { TrainerProfile } from '../game/TrainerProfile';
import { TypeChart } from '../game/TypeChart';
import { getElement } from './dom';

export type BattleEffect = 'trainer' | 'wild' | '';

const TYPE_CLASS: Record<PokemonType, string> = {
  Normal: 'normal', Feuer: 'fire', Wasser: 'water', Elektro: 'electric', Pflanze: 'grass',
  Käfer: 'bug', Fee: 'fairy', Gift: 'poison', Flug: 'flying', Unlicht: 'dark', Boden: 'ground',
  Gestein: 'rock', Kampf: 'fighting', Psycho: 'psychic', Eis: 'ice', Drache: 'dragon',
  Stahl: 'steel', Geist: 'ghost',
};

/** Erstellt die Kampfanzeige aus den unveränderlichen Spielregeln und dem aktuellen Zustand. */
export class BattleView {
  render(
    root: HTMLElement,
    battle: Battle,
    profile: TrainerProfile,
    message: string,
    turnLocked: boolean,
    effect: BattleEffect = '',
    damage: number | null = null,
    moveType: PokemonType | null = null,
  ): void {
    const trainerPokemon = battle.activePokemon;
    const wildPokemon = battle.opponent;
    const replacementMode = battle.needsReplacement;

    const moves = replacementMode || battle.result !== 'playing'
      ? ''
      : trainerPokemon.moves.map((move, index) => {
        const multiplier = TypeChart.multiplier(move.type, wildPokemon.types);
        const effectiveness = multiplier > 1 ? ' · sehr effektiv' : multiplier < 1 ? ' · wenig effektiv' : '';
        const details = move.effect === 'evade'
          ? 'Taktik · weicht aus'
          : `${move.type} · Stärke ${move.power}${effectiveness}`;
        return `<button class="move-button" data-move="${index}" type="button" ${turnLocked ? 'disabled' : ''}>
          <strong>${move.name}</strong><small>${details}</small></button>`;
      }).join('');

    const roster = profile.collection.map(id => {
      const pokemon = POKEMON[id];
      if (!pokemon) return '';
      const isActive = id === profile.activePokemonId;
      const hp = profile.hpOf(id);
      const canSwitch = hp > 0 && !isActive && (replacementMode || !turnLocked);
      return `<button class="battle-roster-choice ${isActive ? 'current' : ''}" data-switch-pokemon="${id}" type="button" ${canSwitch ? '' : 'disabled'}>
        <img src="assets/sprites/${id}.png" alt=""><span>${pokemon.name}<small>KP ${hp}/${pokemon.maxHp}</small></span>${isActive ? '<b>Im Einsatz</b>' : ''}</button>`;
    }).join('');

    let outcome = '';
    if (battle.result === 'lose') {
      outcome = '<p class="battle-message defeat-message">Dein Team ist erschöpft. Geh zum Pokémon-Center und hol dir neue Kraft.</p><button id="closeBattleButton" class="primary-button full">Zum Pokémon-Center gehen</button>';
    } else if (replacementMode) {
      outcome = '<p class="battle-message">Dein Pokémon ist K.O. Such ein anderes aus, Trainer!</p>';
    }

    const effectMarkup = effect && damage !== null && damage > 0
      ? `<div class="attack-effect type-${TYPE_CLASS[moveType ?? 'Normal']} ${effect === 'trainer' ? 'from-trainer' : 'from-wild'}" aria-hidden="true"><i></i><i></i><i></i></div>`
      : '';

    root.innerHTML = `<div class="battle-heading"><span>WILDE BEGEGNUNG</span><h2>Ein wildes ${wildPokemon.name}!</h2></div>
      <div class="battlefield habitat-${battle.habitat} ${effect ? `turn-${effect}` : ''}">
        <div class="battle-platform platform-wild"></div><div class="battle-platform platform-trainer"></div>
        <div class="battle-status status-wild"><div><strong>${wildPokemon.name}</strong><small>${wildPokemon.types.join(' · ')}</small></div><div class="status-hp"><span>KP</span><i><b style="width:${Math.max(0, battle.opponentHp / wildPokemon.maxHp * 100)}%"></b></i></div><small>${battle.opponentHp} / ${wildPokemon.maxHp}</small></div>
        <div class="battle-status status-trainer"><div><strong>${trainerPokemon.name}</strong><small>${trainerPokemon.types.join(' · ')}</small></div><div class="status-hp"><span>KP</span><i><b style="width:${Math.max(0, profile.hpOf(trainerPokemon.id) / trainerPokemon.maxHp * 100)}%"></b></i></div><small>${profile.hpOf(trainerPokemon.id)} / ${trainerPokemon.maxHp}</small></div>
        <div class="fighter trainer-fighter ${effect === 'wild' ? 'taking-hit' : ''} ${effect === 'trainer' ? 'attacking' : ''}"><span class="fighter-art"><img class="battle-sprite" src="assets/sprites/${trainerPokemon.id}-back.gif" alt="${trainerPokemon.name}"></span>${effect === 'wild' && damage !== null && damage > 0 ? `<b class="damage-float">−${damage}</b>` : ''}</div>
        <div class="fighter wild-fighter ${effect === 'trainer' ? 'taking-hit' : ''} ${effect === 'wild' ? 'attacking' : ''}"><span class="fighter-art"><img class="battle-sprite" src="assets/sprites/${wildPokemon.id}-front.gif" alt="${wildPokemon.name}"></span>${effect === 'trainer' && damage !== null && damage > 0 ? `<b class="damage-float">−${damage}</b>` : ''}</div>
        ${effectMarkup}
      </div>
      <section class="battle-command"><p class="battle-message">${message}</p><div class="move-grid">${moves}</div></section>
      <div class="battle-roster"><strong>Team wechseln</strong>${roster}</div>${outcome}`;
  }
}

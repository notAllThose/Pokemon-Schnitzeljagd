import type { PokemonDefinition } from '../domain/types';

/** Die kleine Spieldatenbank: Ein Eintrag pro fangbarem Pokémon. */
export const POKEMON: Record<string, PokemonDefinition> = {
  pikachu: { id: 'pikachu', name: 'Pikachu', dexNumber: 25, category: 'Maus-Pokémon', description: 'In seinen roten Backen speichert Pikachu elektrische Energie. Wenn es aufgeregt ist, knistert es manchmal vor lauter Strom.', height: '0,4 m', weight: '6,0 kg', types: ['Elektro'], color: 'yellow', maxHp: 24, moves: [
    { name: 'Donnerschock', type: 'Elektro', power: 8 }, { name: 'Ruckzuckhieb', type: 'Normal', power: 6 },
    { name: 'Knistern', type: 'Elektro', power: 7 }, { name: 'Ausweichen', type: null, power: 0, effect: 'evade' },
  ] },
  glumanda: { id: 'glumanda', name: 'Glumanda', dexNumber: 4, category: 'Echsen-Pokémon', description: 'Die Flamme an Glumandas Schwanz leuchtet hell. An ihr kann man erkennen, wie munter dieses Feuer-Pokémon gerade ist.', height: '0,6 m', weight: '8,5 kg', types: ['Feuer'], color: 'orange', maxHp: 25, moves: [
    { name: 'Glut', type: 'Feuer', power: 8 }, { name: 'Kratzer', type: 'Normal', power: 6 },
    { name: 'Flammenwirbel', type: 'Feuer', power: 7 }, { name: 'Ausweichen', type: null, power: 0, effect: 'evade' },
  ] },
  schiggy: { id: 'schiggy', name: 'Schiggy', dexNumber: 7, category: 'Kleines Schildkröten-Pokémon', description: 'Bei Gefahr zieht sich Schiggy in seinen Panzer zurück. Aus dem Mund kann es kräftige Wasserstrahlen spritzen.', height: '0,5 m', weight: '9,0 kg', types: ['Wasser'], color: 'blue', maxHp: 26, moves: [
    { name: 'Aquaknarre', type: 'Wasser', power: 8 }, { name: 'Tackle', type: 'Normal', power: 6 },
    { name: 'Blubber', type: 'Wasser', power: 7 }, { name: 'Ausweichen', type: null, power: 0, effect: 'evade' },
  ] },
  bulbasaur: { id: 'bulbasaur', name: 'Bisasam', dexNumber: 1, category: 'Samen-Pokémon', description: 'Auf Bisasams Rücken wächst von Geburt an ein geheimnisvoller Pflanzensamen. Mit der Zeit wird daraus eine große Blüte.', height: '0,7 m', weight: '6,9 kg', types: ['Pflanze', 'Gift'], color: 'green', maxHp: 25, moves: [
    { name: 'Rankenhieb', type: 'Pflanze', power: 8 }, { name: 'Tackle', type: 'Normal', power: 6 },
    { name: 'Blattwirbel', type: 'Pflanze', power: 7 }, { name: 'Ausweichen', type: null, power: 0, effect: 'evade' },
  ] },
  raupy: { id: 'raupy', name: 'Raupy', dexNumber: 10, category: 'Wurm-Pokémon', description: 'Mit seinen kleinen Saugnapf-Füßchen klettert Raupy flink an Bäumen und Wänden hinauf. Sein Lieblingssnack sind frische Blätter.', height: '0,3 m', weight: '2,9 kg', types: ['Käfer'], color: 'green', maxHp: 17, moves: [
    { name: 'Fadenschuss', type: 'Käfer', power: 6 }, { name: 'Tackle', type: 'Normal', power: 6 },
    { name: 'Käferbiss', type: 'Käfer', power: 8 }, { name: 'Ausweichen', type: null, power: 0, effect: 'evade' },
  ] },
  piepi: { id: 'piepi', name: 'Piepi', dexNumber: 35, category: 'Fee-Pokémon', description: 'Piepi wirkt, als wäre es direkt aus einem Märchen gekommen. Nachts beobachtet es gern den Mond am Sternenhimmel.', height: '0,6 m', weight: '7,5 kg', types: ['Fee'], color: 'pink', maxHp: 20, moves: [
    { name: 'Sternenschauer', type: 'Fee', power: 8 }, { name: 'Klaps', type: 'Normal', power: 6 },
    { name: 'Mondfunkeln', type: 'Fee', power: 7 }, { name: 'Ausweichen', type: null, power: 0, effect: 'evade' },
  ] },
  zubat: { id: 'zubat', name: 'Zubat', dexNumber: 41, category: 'Fledermaus-Pokémon', description: 'In dunklen Höhlen findet sich Zubat mit Echo-Lauten zurecht. So kann es fliegen, auch wenn es kaum etwas sieht.', height: '0,8 m', weight: '7,5 kg', types: ['Gift', 'Flug'], color: 'purple', maxHp: 19, moves: [
    { name: 'Flügelschlag', type: 'Flug', power: 7 }, { name: 'Biss', type: 'Unlicht', power: 7 },
    { name: 'Giftstachel', type: 'Gift', power: 8 }, { name: 'Ausweichen', type: null, power: 0, effect: 'evade' },
  ] },
};

export const STARTER_IDS = ['pikachu', 'glumanda', 'schiggy'];

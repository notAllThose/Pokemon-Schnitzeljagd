/** Erwachsenen-Code fürs Pokémon-Center. Vor der Feier hier bei Bedarf ändern. */
export const HEAL_CODE = 'HEIL-001';

/** Codes von den versteckten Pokémon-Tokens. */
export const WILD_TOKEN_CODES: Record<string, string> = {
  'WALD-01': 'raupy',
  'GARTEN-02': 'piepi',
  'HÖHLE-03': 'zubat',
};

/** Jeder Token-Code merkt sich die passende Spielumgebung für Kampf und Pokédex. */
export const WILD_TOKEN_HABITATS: Record<string, import('../domain/types').EncounterHabitat> = {
  'WALD-01': 'forest',
  'GARTEN-02': 'meadow',
  'HÖHLE-03': 'dampcave',
};

export const BADGES = [
  { id: 'mut', name: 'Mut-Orden', emoji: '🔥', task: 'Überwinde die Feuerprobe' },
  { id: 'klug', name: 'Klugheits-Orden', emoji: '🧠', task: 'Löse das Rätsel der Arena' },
  { id: 'team', name: 'Team-Orden', emoji: '🤝', task: 'Meistert eine Teamaufgabe' },
];

import { TrainerProfile } from './TrainerProfile';
import type { TrainerSave } from '../domain/types';

/** Liest und speichert Profile lokal auf genau diesem Gerät. */
export class ProfileRepository {
  private profiles: TrainerProfile[] = [];
  private activeId = '';
  private readonly storageKey = 'entdeckertour-profiles';

  constructor(private readonly storage: Storage = localStorage) {
    this.load();
  }

  get all(): TrainerProfile[] { return this.profiles; }
  get active(): TrainerProfile | null { return this.profiles.find(profile => profile.id === this.activeId) ?? null; }

  create(): TrainerProfile {
    const profile = new TrainerProfile();
    this.profiles.push(profile);
    this.activeId = profile.id;
    this.save();
    return profile;
  }

  select(id: string): TrainerProfile | null {
    if (!this.profiles.some(profile => profile.id === id)) return null;
    this.activeId = id;
    this.save();
    return this.active;
  }

  save(): void {
    const snapshot = { activeId: this.activeId, profiles: this.profiles.map(profile => profile.data) };
    this.storage.setItem(this.storageKey, JSON.stringify(snapshot));
  }

  clear(): void {
    this.profiles = [];
    this.activeId = '';
    this.storage.removeItem(this.storageKey);
    this.storage.removeItem('entdeckertour-save');
  }

  private load(): void {
    try {
      const raw = this.storage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { activeId?: string; profiles?: Partial<TrainerSave>[] };
        this.profiles = (parsed.profiles ?? []).map(profile => new TrainerProfile(profile));
        this.activeId = parsed.activeId ?? '';
        return;
      }
      // Einmalige Migration der Spielstände aus dem ersten Prototyp.
      const old = this.storage.getItem('entdeckertour-save');
      if (old) {
        const migrated = new TrainerProfile(JSON.parse(old) as Partial<TrainerSave>);
        this.profiles = [migrated];
        this.activeId = migrated.id;
        this.save();
      }
    } catch {
      // Bei beschädigtem Speicher startet die App mit einer leeren Trainer-Auswahl.
      this.profiles = [];
      this.activeId = '';
    }
  }
}

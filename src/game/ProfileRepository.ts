import { TrainerProfile } from './TrainerProfile';
import type { TrainerSave } from '../domain/types';

interface SharedProfile {
  id: string;
  data: Partial<TrainerSave>;
}

/** Hält eine lokale Komfortkopie und synchronisiert Profile mit dem Spielserver. */
export class ProfileRepository {
  private profiles: TrainerProfile[] = [];
  private activeId = '';
  private readonly storageKey = 'entdeckertour-profiles';
  private readonly pendingProfiles = new Map<string, TrainerSave>();
  private saveQueue: Promise<void> = Promise.resolve();
  sharedConnected = false;

  constructor(private readonly storage: Storage = localStorage) {
    this.loadLocal();
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
    this.saveLocal();
    return this.active;
  }

  /** Beim ersten Verbinden werden lokale Profile zur gemeinsamen Datenbank übernommen. */
  async connectShared(): Promise<void> {
    const localProfiles = this.profiles.map(profile => profile.data);
    const localActiveId = this.activeId;
    let remoteProfiles = await this.fetchSharedProfiles();
    const remoteIds = new Set(remoteProfiles.map(profile => profile.id));

    for (const profile of localProfiles) {
      // Bereits vorhandene Serverdaten sind maßgeblich; neue lokale Profile
      // werden zusätzlich übernommen, damit mehrere Geräte zusammenfinden.
      if (!remoteIds.has(profile.id)) await this.sendProfile(profile);
    }

    remoteProfiles = await this.fetchSharedProfiles();
    this.profiles = remoteProfiles.map(profile => new TrainerProfile(profile.data));
    this.activeId = this.profiles.some(profile => profile.id === localActiveId) ? localActiveId : '';
    this.sharedConnected = true;
    this.saveLocal();
  }

  /** Aktualisiert die Trainerliste, etwa beim Öffnen der Trainer-Auswahl. */
  async refreshShared(preserveActive = true): Promise<void> {
    const remoteProfiles = await this.fetchSharedProfiles();
    const activeProfile = preserveActive ? this.active : null;
    const profilesById = new Map<string, TrainerProfile>();

    for (const profile of remoteProfiles) {
      const pending = this.pendingProfiles.get(profile.id);
      if (pending) profilesById.set(profile.id, new TrainerProfile(pending));
      else if (activeProfile?.id === profile.id) profilesById.set(profile.id, activeProfile);
      else profilesById.set(profile.id, new TrainerProfile(profile.data));
    }

    // Keep local profiles while their first save is waiting for the server.
    for (const profile of this.profiles) {
      if (!profilesById.has(profile.id) && (this.pendingProfiles.has(profile.id) || activeProfile?.id === profile.id)) {
        profilesById.set(profile.id, profile);
      }
    }
    this.profiles = [...profilesById.values()];
    if (!this.profiles.some(profile => profile.id === this.activeId)) this.activeId = '';
    this.sharedConnected = true;
    this.saveLocal();
  }

  save(): void {
    this.saveLocal();
    if (!this.active) return;

    // Serialise writes and retain only the newest snapshot per trainer so
    // rapid taps cannot make an older request overwrite a newer save.
    const profileId = this.active.id;
    this.pendingProfiles.set(profileId, JSON.parse(JSON.stringify(this.active.data)) as TrainerSave);
    this.saveQueue = this.saveQueue
      .then(() => this.flushPending())
      .catch(error => console.error('Spielstand konnte nicht synchronisiert werden.', error));
  }

  clear(): void {
    this.profiles = [];
    this.activeId = '';
    this.pendingProfiles.clear();
    this.storage.removeItem(this.storageKey);
    this.storage.removeItem('entdeckertour-save');
    this.saveQueue = this.saveQueue
      .then(async () => {
        const response = await fetch('/api/profiles', { method: 'DELETE' });
        if (!response.ok) throw new Error('Server konnte die Trainerkarten nicht löschen.');
      })
      .catch(error => console.error('Gemeinsame Trainerkarten konnten nicht gelöscht werden.', error));
  }

  private async fetchSharedProfiles(): Promise<SharedProfile[]> {
    const response = await fetch('/api/profiles', { cache: 'no-store' });
    if (!response.ok) throw new Error('Der gemeinsame Spielserver ist nicht erreichbar.');
    const result = await response.json() as { profiles?: SharedProfile[] };
    return result.profiles ?? [];
  }

  private async sendProfile(profile: TrainerSave): Promise<void> {
    const response = await fetch(`/api/profiles/${encodeURIComponent(profile.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile }),
    });
    if (!response.ok) throw new Error('Trainerkarte konnte nicht gespeichert werden.');
  }

  private async flushPending(): Promise<void> {
    while (this.pendingProfiles.size) {
      const [profileId, snapshot] = this.pendingProfiles.entries().next().value as [string, TrainerSave];
      await this.sendProfile(snapshot);
      if (this.pendingProfiles.get(profileId) === snapshot) this.pendingProfiles.delete(profileId);
    }
  }

  private saveLocal(): void {
    const snapshot = { activeId: this.activeId, profiles: this.profiles.map(profile => profile.data) };
    this.storage.setItem(this.storageKey, JSON.stringify(snapshot));
  }

  private loadLocal(): void {
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
        this.saveLocal();
      }
    } catch {
      // Bei beschädigtem Speicher startet die App mit einer leeren Trainer-Auswahl.
      this.profiles = [];
      this.activeId = '';
    }
  }
}

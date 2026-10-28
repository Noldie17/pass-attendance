import type { PassDatabase } from './db'
import type { AppSettings } from '@shared/types'

const defaults: AppSettings = { late_cutoff: '07:45', cooldown_sec: 5, sound: true, default_camera: '', pin_enabled: false }

export class SettingsService {
  constructor(private readonly db: PassDatabase) {}

  get(): AppSettings {
    const stored = new Map(this.db.all<{ key: string; value: string }>('SELECT key,value FROM settings').map(row => [row.key, row.value]))
    return {
      late_cutoff: stored.get('late_cutoff') ?? defaults.late_cutoff,
      cooldown_sec: Number(stored.get('cooldown_sec') ?? defaults.cooldown_sec),
      sound: (stored.get('sound') ?? String(defaults.sound)) === 'true',
      default_camera: stored.get('default_camera') ?? defaults.default_camera,
      pin_enabled: Boolean(stored.get('pin_hash'))
    }
  }

  async save(patch: Partial<AppSettings>): Promise<AppSettings> {
    const current = this.get()
    const next = { ...current, ...patch }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(next.late_cutoff)) throw new Error('Late cutoff must use HH:MM (24-hour) format.')
    if (!Number.isInteger(next.cooldown_sec) || next.cooldown_sec < 0 || next.cooldown_sec > 3600) throw new Error('Cooldown must be an integer from 0 to 3600 seconds.')
    await this.db.write(database => {
      for (const key of ['late_cutoff', 'cooldown_sec', 'sound', 'default_camera'] as const) {
        database.run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [key, String(next[key])])
      }
    })
    return this.get()
  }
}

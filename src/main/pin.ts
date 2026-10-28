import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { PassDatabase } from './db'

export class PinService {
  constructor(private readonly db: PassDatabase) {}

  async set(pin: string | null): Promise<void> {
    if (pin !== null && !/^\d{4,12}$/.test(pin)) throw new Error('PIN must contain 4 to 12 digits.')
    await this.db.write(database => {
      if (pin === null) database.run("DELETE FROM settings WHERE key='pin_hash'")
      else {
        const salt = randomBytes(16).toString('hex')
        database.run("INSERT INTO settings(key,value) VALUES('pin_hash',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [`${salt}:${deriveHash(pin, salt)}`])
      }
    })
  }

  async verify(pin: string): Promise<boolean> {
    const stored = this.db.get<{ value: string }>("SELECT value FROM settings WHERE key='pin_hash'")?.value
    if (!stored) return false
    const [salt, hash] = stored.split(':')
    const actual = deriveHash(pin, salt)
    const expectedBuffer = Buffer.from(hash, 'hex')
    const actualBuffer = Buffer.from(actual, 'hex')
    return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer)
  }
}

function deriveHash(pin: string, salt: string): string {
  return scryptSync(pin, salt, 64).toString('hex')
}

import { describe, expect, it } from 'vitest'
import { scanResultSound } from '../src/shared/sounds'

describe('scan result sound mapping', () => {
  it('distinguishes success, duplicate, unknown, and cooldown results', () => {
    expect(scanResultSound('recorded')).toBe('success')
    expect(scanResultSound('already-recorded')).toBe('duplicate')
    expect(scanResultSound('not-found')).toBe('unknown')
    expect(scanResultSound('cooldown-ignored')).toBeNull()
  })
})

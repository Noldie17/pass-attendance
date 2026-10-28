import { describe, expect, it } from 'vitest'
import { parseCsv } from '../src/main/scan-log'

describe('read-only CSV log parsing', () => {
  it('parses quoted commas, doubled quotes, and embedded line breaks', () => {
    expect(parseCsv('name,note\r\n"Doe, Jane","said ""hello""\nand left"\r\n'))
      .toEqual([['name', 'note'], ['Doe, Jane', 'said "hello"\nand left']])
  })
})

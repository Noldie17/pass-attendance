import type { ScanResultCode, ScanSound } from './types'

export function scanResultSound(code: ScanResultCode): ScanSound {
  if (code === 'recorded') return 'success'
  if (code === 'already-recorded') return 'duplicate'
  if (code === 'not-found') return 'unknown'
  return null
}

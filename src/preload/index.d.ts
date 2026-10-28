import type { PassApi } from '@shared/types'

declare global {
  interface Window { pass: PassApi }
}
export {}

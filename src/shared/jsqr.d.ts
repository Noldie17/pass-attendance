declare module 'jsqr' {
  interface QRCodeResult { data: string; location: unknown }
  export default function jsQR(data: Uint8ClampedArray, width: number, height: number, options?: { inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst' }): QRCodeResult | null
}

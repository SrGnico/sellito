export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Relación de contraste WCAG (1 a 21).
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// Color del texto y los sellos: blanco o verde de la marca, el que más contraste tenga con el fondo.
// Google Wallet elige el color del texto solo, así que no lo dejamos elegir al dueño.
// Mismo criterio que autoTextColor en functions/src/images/stamps.ts.
export function autoTextColor(bg: string): string {
  return contrastRatio(bg, '#FFFFFF') >= contrastRatio(bg, '#12372A') ? '#FFFFFF' : '#12372A'
}

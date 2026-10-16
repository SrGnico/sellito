// Íconos predefinidos del sello: trazos en una caja de 24×24, dibujados con `currentColor`.
// Son datos (no JSX) para que la Function de imágenes (paso 6) pueda reusarlos.
export type StampIcon = { id: string; label: string; paths: string[]; strokeWidth?: number }

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`

export const CHECK_ICON: StampIcon = { id: 'tilde', label: 'Tilde', paths: ['M5 12.5l4.5 4.5L19 7.5'], strokeWidth: 3 }

export const STAMP_ICONS: StampIcon[] = [
  {
    id: 'cafe',
    label: 'Café',
    paths: [
      'M4 9h12v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9z',
      'M16 10h1.5a2.5 2.5 0 0 1 0 5H16',
      'M8 3c0 1.5 1 1.5 1 3M12 3c0 1.5 1 1.5 1 3',
      'M4 21h12',
    ],
  },
  { id: 'estrella', label: 'Estrella', paths: ['M12 2.5l2.9 6.1 6.6.7-4.9 4.5 1.4 6.6L12 17l-6 3.4 1.4-6.6-4.9-4.5 6.6-.7z'] },
  { id: 'corazon', label: 'Corazón', paths: ['M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z'] },
  { id: 'tijera', label: 'Tijera', paths: [circle(6, 6, 3), circle(6, 18, 3), 'M8.6 7.6L20 18M8.6 16.4L20 6'] },
  {
    id: 'pizza',
    label: 'Pizza',
    paths: ['M12 21L3 5c6-3 12-3 18 0z', 'M4.6 8c4.9-2.3 9.9-2.3 14.8 0', circle(10, 11, 1), circle(14, 12.5, 1), circle(12, 16, 1)],
  },
  { id: 'helado', label: 'Helado', paths: ['M7 11a5 5 0 0 1 10 0z', 'M7.5 11L12 21l4.5-10'] },
  {
    id: 'hamburguesa',
    label: 'Hamburguesa',
    paths: ['M4 11a8 6 0 0 1 16 0z', 'M3 14.5h18', 'M4 17.5h16v.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z'],
  },
  {
    id: 'flor',
    label: 'Flor',
    paths: [
      circle(12, 12, 2.5),
      'M12 9.5C10 7 10 4 12 3c2 1 2 4 0 6.5zM12 14.5c2 2.5 2 5.5 0 6.5-2-1-2-4 0-6.5zM9.5 12C7 14 4 14 3 12c1-2 4-2 6.5 0zM14.5 12c2.5-2 5.5-2 6.5 0-1 2-4 2-6.5 0z',
    ],
  },
  { id: 'medialuna', label: 'Medialuna', paths: ['M3.5 15.5C3.5 10 7.5 6 12 6s8.5 4 8.5 9.5', 'M3.5 15.5c2.5 1.7 5 2.5 8.5 2.5s6-.8 8.5-2.5', 'M8 8l1.5 9M12 6v12M16 8l-1.5 9'] },
  { id: 'mate', label: 'Mate', paths: ['M7 9.5h10c1 1.8 1.5 3.6 1.5 5.5a6.5 6.5 0 0 1-13 0c0-1.9.5-3.7 1.5-5.5z', 'M13.5 9.5L17 3', 'M15.8 3h2.7'] },
  { id: 'cerveza', label: 'Cerveza', paths: ['M5 8h10v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z', 'M15 11h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2', 'M5 8a2.5 2.5 0 0 1 3-3 2.8 2.8 0 0 1 4.5 0A2.5 2.5 0 0 1 15 8', 'M8.5 12v5M11.5 12v5'] },
  { id: 'copa', label: 'Copa', paths: ['M7 3h10c0 5-2 8.5-5 8.5S7 8 7 3z', 'M12 11.5V20', 'M8 21h8'] },
  { id: 'torta', label: 'Torta', paths: ['M4 21h16', 'M5 21v-8h14v8', 'M5 16c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3.5 1.3 5 0', 'M12 13V9', 'M12 6.5c-1-1-.4-2.3 0-3.5.4 1.2 1 2.5 0 3.5z'] },
  { id: 'regalo', label: 'Regalo', paths: ['M4.5 11h15v10h-15z', 'M3 7h18v4H3z', 'M12 7v14', 'M12 7C10.5 4 7 3.5 7 5.5S10 7 12 7zM12 7c1.5-3 5-3.5 5-1.5S14 7 12 7z'] },
  { id: 'huella', label: 'Mascotas', paths: ['M7.5 17.5c0-2.6 2-5 4.5-5s4.5 2.4 4.5 5c0 2-2 2.7-4.5 2.7s-4.5-.7-4.5-2.7z', circle(5.5, 10.5, 1.8), circle(9.5, 6.5, 1.8), circle(14.5, 6.5, 1.8), circle(18.5, 10.5, 1.8)] },
  { id: 'pesa', label: 'Gimnasio', paths: ['M7 6.5v11M17 6.5v11', 'M4 9.5v5M20 9.5v5', 'M7 12h10'] },
  { id: 'hoja', label: 'Hoja', paths: ['M5 19C5 10 10 5 20 4c-1 10-6 15-15 15z', 'M5 19l9-9'] },
  { id: 'bolsa', label: 'Compras', paths: ['M5 8h14l-1 13H6z', 'M9 10V6.5a3 3 0 0 1 6 0V10'] },
  { id: 'esmalte', label: 'Uñas', paths: ['M8 11h8v9a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z', 'M10 11V3.5h4V11'] },
  { id: 'gota', label: 'Gota', paths: ['M12 3c3.3 4.2 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 2.7-6.8 6-11z'] },
  { id: 'auto', label: 'Auto', paths: ['M5 16H3v-3.5L5.5 8h13l2.5 4.5V16h-2', 'M9 16h6', 'M3 12.5h18', circle(7, 16, 2), circle(17, 16, 2)] },
  { id: 'nota', label: 'Música', paths: ['M9 18V5.5l11-2.5v13', circle(6.5, 18, 2.5), circle(17.5, 16, 2.5)] },
  { id: 'corona', label: 'Corona', paths: ['M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z'] },
  { id: 'sonrisa', label: 'Sonrisa', paths: [circle(12, 12, 9), 'M8 14c1 1.6 2.4 2.4 4 2.4s3-.8 4-2.4', 'M9 9.5v1M15 9.5v1'] },
]

export function stampIconById(id: string | undefined): StampIcon | undefined {
  return STAMP_ICONS.find((i) => i.id === id)
}

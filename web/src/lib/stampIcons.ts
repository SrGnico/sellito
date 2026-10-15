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
]

export function stampIconById(id: string | undefined): StampIcon | undefined {
  return STAMP_ICONS.find((i) => i.id === id)
}

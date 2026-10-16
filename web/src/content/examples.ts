import cafeBanner from '../assets/examples/cafe-lola-banner.svg'
import cafeLogo from '../assets/examples/cafe-lola-logo.svg'
import cafeWide from '../assets/examples/cafe-lola-wide.svg'
import florBanner from '../assets/examples/flor-banner.svg'
import florLogo from '../assets/examples/flor-logo.svg'
import florWide from '../assets/examples/flor-wide.svg'
import nubeBanner from '../assets/examples/nube-banner.svg'
import nubeLogo from '../assets/examples/nube-logo.svg'
import nubeWide from '../assets/examples/nube-wide.svg'
import solBanner from '../assets/examples/sol-banner.svg'
import solLogo from '../assets/examples/sol-logo.svg'
import solWide from '../assets/examples/sol-wide.svg'
import tanoBanner from '../assets/examples/tano-banner.svg'
import tanoLogo from '../assets/examples/tano-logo.svg'
import tanoWide from '../assets/examples/tano-wide.svg'
import type { CardConfig } from '../lib/cardDesign'

// Negocios de ejemplo de la landing (inventados): muestran que sirve para cualquier rubro, con logo,
// logo horizontal, banner y premios que no siempre son un producto.
export type Example = CardConfig & { filled: number; rubro: string; notice: string }

const base = { askFields: { name: true, phone: true, email: false }, locations: [], proximityEnabled: false, conditions: '' }

export const EXAMPLES: Example[] = [
  {
    ...base,
    rubro: 'Cafetería',
    name: 'Café Lola',
    logoUrl: cafeLogo,
    wideLogoUrl: cafeWide,
    bannerUrl: cafeBanner,
    bgColor: '#FF9EC4',
    stampIconId: 'cafe',
    stampsRequired: 8,
    rewardText: 'un café gratis',
    itemSingular: 'café',
    itemPlural: 'cafés',
    filled: 7,
    notice: '¡Te falta 1 café para tu premio!\u00A0☕',
  },
  {
    ...base,
    rubro: 'Peluquería',
    name: 'Peluquería Sol',
    logoUrl: solLogo,
    wideLogoUrl: solWide,
    bannerUrl: solBanner,
    bgColor: '#12372A',
    stampIconId: 'tijera',
    stampsRequired: 5,
    rewardText: '50% en tu próximo corte',
    itemSingular: 'corte',
    itemPlural: 'cortes',
    filled: 3,
    notice: 'Este jueves, corte + barba con doble sello\u00A0✂️',
  },
  {
    ...base,
    rubro: 'Heladería',
    name: 'Heladería Nube',
    logoUrl: nubeLogo,
    wideLogoUrl: nubeWide,
    bannerUrl: nubeBanner,
    bgColor: '#8EC5FF',
    stampIconId: 'helado',
    stampsRequired: 10,
    rewardText: 'un cuarto de helado',
    itemSingular: 'helado',
    itemPlural: 'helados',
    filled: 10,
    notice: '¡Completaste tu tarjeta! Pasá a buscar tu cuarto\u00A0🍦',
  },
  {
    ...base,
    rubro: 'Pizzería',
    name: 'Pizzería Don Tano',
    logoUrl: tanoLogo,
    wideLogoUrl: tanoWide,
    bannerUrl: tanoBanner,
    bgColor: '#C23838',
    stampIconId: 'pizza',
    stampsRequired: 8,
    rewardText: 'una grande de muzza',
    itemSingular: 'pizza',
    itemPlural: 'pizzas',
    filled: 5,
    notice: '¡Feliz cumple, Martina! Hoy tenés una grande de regalo\u00A0🎂',
  },
  {
    ...base,
    rubro: 'Estudio',
    name: 'Flor Pilates',
    logoUrl: florLogo,
    wideLogoUrl: florWide,
    bannerUrl: florBanner,
    bgColor: '#E9D8FF',
    stampIconId: 'flor',
    stampsRequired: 10,
    rewardText: '20% en tu próximo mes',
    itemSingular: 'clase',
    itemPlural: 'clases',
    filled: 6,
    notice: 'Nueva clase de yoga los sábados 10 h\u00A0🌸',
  },
]

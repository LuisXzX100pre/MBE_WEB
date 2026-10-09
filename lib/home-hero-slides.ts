import { socialLinks } from './social-links'
import { homeHeroImage, productStock, type ColorVariant } from './product-variants'
type SlideBase = { id: string; eyebrow: string; title: string; subtitle: string; image?: string | null; ctaHref: string; ctaLabel: string }
export type HomeHeroSlide =
  | (SlideBase & { type: 'PRODUCT'; priceText: string; soldOut: boolean })
  | (SlideBase & { type: 'COMMUNITY' | 'BRAND' })
  | (SlideBase & { type: 'SOCIAL'; secondaryCta: { href: string; label: string } })
type PromoProduct = { homeHeroImageUrl?: string | null; colors?: ColorVariant[]; id: string; name: string; description: string | null; price: number; stock: number; sizes: { stock: number }[]; images: { url: string }[]; category: { name: string } }
export type HomeCampaign = { name: string; title: string | null; subtitle: string | null; description: string | null; note: string | null }
export function buildHeroSlides(products: PromoProduct[], campaign: HomeCampaign | null): HomeHeroSlide[] {
  const productSlides: HomeHeroSlide[] = products.slice(0, 3).map(product => ({
    id: 'product-' + product.id, type: 'PRODUCT', eyebrow: product.category.name, title: product.name,
    subtitle: product.description?.trim() || 'Descubre la propuesta de ' + product.category.name + '.',
    priceText: '$' + Number(product.price).toFixed(2) + ' MXN', image: homeHeroImage(product),
    // Shared availability across ProductCard, ProductDetail and the Home.
    soldOut: productStock(product) <= 0,
    ctaHref: '/productos/' + product.id, ctaLabel: 'Ver producto',
  }))
  const community: HomeHeroSlide = {
    id: 'community', type: 'COMMUNITY', eyebrow: 'MBE Community', title: campaign?.title || campaign?.name || 'Lo que no sale afuera.',
    subtitle: campaign ? [campaign.subtitle, campaign.description || campaign.note].filter(Boolean).join(' ') || 'Una mirada al interior de MBE.' : 'Adelantos, procesos y beneficios para quienes están dentro.',
    ctaHref: '/comunidad', ctaLabel: 'Entrar a Comunidad', image: '/ICONO_LOGO.png',
  }
  const social: HomeHeroSlide = {
    id: 'social', type: 'SOCIAL', eyebrow: 'MBE / Sigue el proceso', title: 'Antes del próximo movimiento.',
    subtitle: 'Lo que pasa antes de cada drop empieza aquí. Sigue a MBE en Instagram y TikTok.',
    ctaHref: socialLinks.instagram.href, ctaLabel: socialLinks.instagram.label,
    secondaryCta: socialLinks.tiktok, image: '/logo.png',
  }
  if (!productSlides.length) return [community, social, {
    id: 'brand', type: 'BRAND', eyebrow: 'MBE', title: 'Explora la marca.', subtitle: 'Streetwear, próximos drops y una mirada al interior de MBE.',
    ctaHref: '/productos', ctaLabel: 'Explorar productos', image: '/logo.png',
  }]
  return [productSlides[0], community, ...(productSlides[1] ? [productSlides[1]] : []), social, ...(productSlides[2] ? [productSlides[2]] : [])]
}
export function carouselIndex(index: number, count: number) { return count > 0 ? ((index % count) + count) % count : 0 }

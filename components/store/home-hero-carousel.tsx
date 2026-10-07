'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { carouselIndex, type HomeHeroSlide } from '@/lib/home-hero-slides'
import styles from './home-hero-carousel.module.css'
export type { HomeHeroSlide } from '@/lib/home-hero-slides'
const fallback: HomeHeroSlide[] = [{ id: 'brand-default', type: 'BRAND', eyebrow: 'MBE', title: 'Explora la marca.', subtitle: 'Streetwear, drops y una mirada al interior de MBE.', image: '/logo.png', ctaHref: '/productos', ctaLabel: 'Explorar productos' }]
export function HomeHeroCarousel({ slides }: { slides: HomeHeroSlide[] }) {
  const safeSlides = slides.length ? slides : fallback
  const [activeIndex, setActiveIndex] = useState(0), [hovered, setHovered] = useState(false), [focused, setFocused] = useState(false)
  const [interacting, setInteracting] = useState(false), [paused, setPaused] = useState(false), [reduced, setReduced] = useState(false), [hidden, setHidden] = useState(false), [interactionKey, setInteractionKey] = useState(0)
  const drag = useRef<{ x: number; y: number; id: number } | null>(null), suppressClickUntil = useRef(0), direction = useRef(1)
  const index = carouselIndex(activeIndex, safeSlides.length), slide = safeSlides[index], hasMultiple = safeSlides.length > 1
  const stopped = paused || hovered || focused || interacting || reduced || hidden
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const motion = () => setReduced(preference.matches), visibility = () => setHidden(document.hidden)
    motion(); visibility()
    preference.addEventListener('change', motion); document.addEventListener('visibilitychange', visibility)
    return () => { preference.removeEventListener('change', motion); document.removeEventListener('visibilitychange', visibility) }
  }, [])
  // One scheduled advance at a time. Every interaction restarts the six-second delay.
  useEffect(() => {
    if (!hasMultiple || stopped) return
    const timer = setTimeout(() => { direction.current = 1; setActiveIndex(previous => carouselIndex(previous + 1, safeSlides.length)) }, 6000)
    return () => clearTimeout(timer)
  }, [activeIndex, hasMultiple, stopped, safeSlides.length, interactionKey])
  function navigate(target: number, step = 1) {
    direction.current = step; setActiveIndex(carouselIndex(target, safeSlides.length)); setInteractionKey(previous => previous + 1)
  }
  return <section aria-label="Destacados de MBE" aria-roledescription="carrusel" className="w-full min-w-0"
    onPointerEnter={event => { if (event.pointerType === 'mouse') setHovered(true) }}
    onPointerLeave={event => { if (event.pointerType === 'mouse') setHovered(false) }}
    onFocusCapture={() => setFocused(true)}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false) }}
    onPointerDown={event => {
      if (event.pointerType !== 'touch' || !event.isPrimary) return
      drag.current = { x: event.clientX, y: event.clientY, id: event.pointerId }; setInteracting(true)
    }}
    onPointerUp={event => {
      const start = drag.current
      if (!start || start.id !== event.pointerId) return
      drag.current = null; setInteracting(false)
      const dx = event.clientX - start.x, dy = event.clientY - start.y
      if (hasMultiple && Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        navigate(index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1); suppressClickUntil.current = Date.now() + 350
      }
    }}
    onPointerCancel={() => { drag.current = null; setInteracting(false) }}
    onClickCapture={event => { if (Date.now() < suppressClickUntil.current) { event.preventDefault(); event.stopPropagation() } }}
    style={{ touchAction: 'pan-y pinch-zoom' }}>
    <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br from-[#080808] via-[#101010] to-[#050505] text-white shadow-[0_25px_90px_rgba(0,0,0,0.42)] sm:rounded-[32px]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_45%)]" />
      <div key={slide.id} role="group" aria-roledescription="slide" aria-label={`${index + 1} de ${safeSlides.length}`} className={direction.current < 0 ? styles.enterBack : styles.enter}>
        <div className="relative grid items-center gap-5 px-4 py-5 sm:gap-7 sm:px-7 sm:py-7 lg:min-h-[510px] lg:grid-cols-[1fr_1.05fr] lg:gap-10 lg:px-10">
          <div className="order-2 min-w-0 lg:order-1">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/60 sm:text-[10px]"><span>{slide.eyebrow}</span>{slide.type === 'PRODUCT' && <><span aria-hidden="true">/</span><span>{slide.priceText}</span></>}</div>
            <h2 className="break-words text-2xl font-black uppercase leading-tight tracking-tight sm:text-4xl lg:text-5xl">{slide.title}</h2>
            <p className="mt-3 line-clamp-3 max-w-xl break-words text-xs leading-5 text-white/60 sm:text-sm sm:leading-6">{slide.subtitle}</p>
            {slide.type === 'PRODUCT' && <p className={'mt-4 inline-flex border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] ' + (slide.soldOut ? 'border-white/30 text-white/80' : 'border-white/15 text-white/55')}>{slide.soldOut ? 'SOLD OUT' : 'Disponible'}</p>}
            <div className="mt-5 flex flex-wrap gap-3">
              {slide.type === 'SOCIAL' ? <><a href={slide.ctaHref} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 border border-white/30 px-4 py-3 text-xs font-semibold hover:bg-white/10">{slide.ctaLabel}<ArrowRight size={14} aria-hidden="true" /></a><a href={slide.secondaryCta.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 border border-white/30 px-4 py-3 text-xs font-semibold hover:bg-white/10">{slide.secondaryCta.label}<ArrowRight size={14} aria-hidden="true" /></a></>
              : <Link href={slide.ctaHref} prefetch={slide.type === 'COMMUNITY' ? false : undefined} className="inline-flex min-h-11 items-center justify-center gap-2 bg-white px-5 py-3 text-xs font-bold text-black hover:bg-white/90">{slide.ctaLabel}<ArrowRight size={14} aria-hidden="true" /></Link>}
            </div>
          </div>
          <div className="order-1 min-w-0 lg:order-2">
            <div className="relative flex h-[180px] items-center justify-center overflow-hidden rounded-[18px] border border-white/10 bg-black/25 sm:h-[270px] lg:h-[410px]">
              {slide.type === 'PRODUCT' && slide.image ? <Image src={slide.image} alt={slide.title} fill sizes="(max-width: 1024px) 90vw, 45vw" className="object-contain" priority={index === 0} draggable={false} />
              : <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-8"><Image src={slide.type === 'COMMUNITY' ? '/ICONO_LOGO.png' : '/logo.png'} alt="MBE" width={slide.type === 'COMMUNITY' ? 140 : 360} height={slide.type === 'COMMUNITY' ? 140 : 190} className={slide.type === 'COMMUNITY' ? 'h-24 w-24 rounded-full object-contain sm:h-36 sm:w-36' : 'h-auto max-h-28 w-full max-w-xs object-contain sm:max-h-40'} draggable={false} /><span className="text-[9px] uppercase tracking-[0.25em] text-white/35">{slide.type === 'COMMUNITY' ? 'Lo que no sale afuera' : slide.type === 'SOCIAL' ? 'Instagram / TikTok' : 'MBE / Streetwear'}</span></div>}
            </div>
          </div>
        </div>
      </div>
      {hasMultiple && <div className="relative flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-3 sm:px-7">
        <div className="flex items-center gap-1"><button type="button" onClick={() => navigate(index - 1, -1)} aria-label="Slide anterior" className="flex h-11 w-11 items-center justify-center hover:bg-white/10"><ChevronLeft size={18} /></button><button type="button" onClick={() => navigate(index + 1)} aria-label="Slide siguiente" className="flex h-11 w-11 items-center justify-center hover:bg-white/10"><ChevronRight size={18} /></button></div>
        <div className="flex items-center" aria-label="Seleccionar slide">{safeSlides.map((item, slideIndex) => <button key={item.id} type="button" onClick={() => navigate(slideIndex, slideIndex < index ? -1 : 1)} aria-label={`Ir al slide ${slideIndex + 1}: ${item.title}`} aria-current={slideIndex === index ? 'true' : undefined} className="flex h-11 w-5 items-center sm:w-7 justify-center"><span aria-hidden="true" className={'h-1.5 rounded-full ' + (slideIndex === index ? 'w-5 bg-white' : 'w-1.5 bg-white/30')} /></button>)}</div>
        <button type="button" disabled={reduced} onClick={() => setPaused(previous => !previous)} aria-label={reduced ? 'Rotación automática desactivada por movimiento reducido' : paused ? 'Reanudar rotación automática' : 'Pausar rotación automática'} className="flex h-11 w-11 items-center justify-center hover:bg-white/10 disabled:opacity-40">{paused || reduced ? <Play size={16} /> : <Pause size={16} />}</button>
      </div>}
      <p className="sr-only" aria-live={stopped ? 'polite' : 'off'} aria-atomic="true">Slide {index + 1} de {safeSlides.length}: {slide.title}</p>
    </div>
  </section>
}

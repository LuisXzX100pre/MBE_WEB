# Home carousel y branding MBE

Rama: feat/home-carousel-branding. Esta fase no requiere schema, migraciones, nuevas variables ni dependencias.

## Prioridad de drops
HomeHeroSwitcher permanece intacto: nextDrop -> DropCountdown; si no existe, recentDrop dentro de la ventana existente de tres días -> LiveDropFixedHero; si faltan ambos -> HomeHeroCarousel. La consulta y liberación automática de drops existentes no cambian. El slide de Comunidad nunca desplaza un drop. La campaña solo se consulta cuando corresponde el modo carousel.

## Slides e inventario
buildHeroSlides se extrae de app/page.tsx a lib/home-hero-slides.ts para probar su composición. Conserva la consulta Prisma de los tres productos ACTIVE más recientes y añade sizes a esa lectura. Orden: producto 1, Comunidad, producto 2, redes, producto 3 (omite los productos que falten). Máximo cinco slides. Sin productos: Comunidad, redes y marca, con assets MBE existentes y sin «Sin imagen principal».

SOLD OUT se calcula igual que ProductCard y ProductDetail: si existen tallas, suma ProductSize.stock; si no, usa Product.stock. Un total <=0 muestra SOLD OUT, sin «Disponible»; el enlace «Ver producto» se conserva. Solo se lee inventario; no hay sincronizaciones nuevas ni escrituras.

Community lee name/title/subtitle/description/note de la campaña vigente con liveCampaignWhere() y el mismo desempate createdAt/id descendente que la ruleta. No lee ni escribe giros. Sin campaña se usa copy evergreen intencional, no una campaña ficticia. CTA /comunidad y prefetch=false: mantiene el flujo de login/código/membresía existente.

Footer y slide social consumen lib/social-links.ts. Se conservan exactamente las URLs oficiales anteriores de Instagram y TikTok, sin variables de entorno. El carrusel abre ambas en otra pestaña con noopener noreferrer.

## Interacción y móvil
Una sola llamada setTimeout programa el siguiente slide cada seis segundos, avanza al siguiente y vuelve al primero. Cada cambio o interacción limpia el timer anterior. Hover con ratón, foco dentro, gesto táctil, pestaña oculta y pausa explícita suspenden el avance. Cuando cesan, se inicia otra espera completa. El autoplay permanece pausado mientras un control/link conserva foco; vuelve al salir del carrusel. Hay controles anterior/siguiente, puntos y pausa/reanudación.

Swipe táctil: gesto horizontal de al menos 40px, mayor que el movimiento vertical por factor 1.2. Izquierda avanza; derecha retrocede. Pan vertical y pinch zoom siguen permitidos; pointercancel libera la pausa. Tras un swipe se evita el click accidental del CTA. No hay librería nueva.

prefers-reduced-motion desactiva autoplay y animación, incluso si cambia durante la sesión; navegación manual continúa disponible. La animación normal entra desde derecha/izquierda según dirección. Controles bajo el contenido, imagen mobile de 180px, copy limitado a tres líneas y títulos con wrap. Revisar manualmente 320/375/390/430px y desktop con textos reales.

## Metadata e iconos
Título raíz exacto: Sitio web oficial de MBE. Descripción breve de streetwear, drops y Comunidad. Open Graph incluye título, descripción, siteName MBE, website y locale es_MX. No se generan imágenes sociales.

public/ICONO_LOGO.png es una imagen PNG válida de 1024x1024. app/icon.png es una copia exacta del isotipo existente y usa la convención de icono de Next App Router. metadata.icons.icon/shortcut/apple apuntan a /ICONO_LOGO.png; antes apple apuntaba a un asset Vercel. No existía app/favicon.ico que sobrescribiera el isotipo. Los archivos de icono antiguos de public quedan sin referencia en metadata; no tienen prioridad por la convención App Router. El diseño del logo no cambia.

Tras deploy o reinicio, abrir /ICONO_LOGO.png y /icon.png y comprobar el logo MBE. En DevTools inspeccionar <title>, links rel=icon y apple-touch-icon: deben apuntar a MBE. Verificar document.title, pestaña de navegador, recarga forzada y caché/incógnito. Según [Google Search Central](https://developers.google.com/search/docs/appearance/favicon-in-search), el favicon requiere nuevo rastreo y procesamiento, que puede tardar días o semanas. El título de Search también depende del rastreo; no se promete actualización inmediata ni se modifica robots/sitemap.

## Validación y límites
npx prisma validate; npx tsc --noEmit; npm run lint; node --test tests/home-carousel-branding.test.cjs tests/community-campaign-wheel.test.cjs tests/community-access.test.cjs tests/community-security.test.cjs tests/community-membership.test.cjs tests/categories-admin.test.cjs. En Codex Windows se usa NODE_OPTIONS=--test-isolation=none.

Pruebas con datos/sesiones simuladas, render React y temporizadores controlados cubren prioridad de drops, inventario por tallas, campañas, redes, fallback, índices, pausa/autoplay/swipe/reduced-motion y metadata/icono. No constituyen QA contra Supabase ni despliegue real. El navegador integrado no pudo acceder a la preview local; la revisión visual en los cuatro anchos queda pendiente de prueba manual. El CSS se compiló con Tailwind local sin actualizar dependencias.

## Prueba manual
1. Usar un entorno de prueba existente con sus migraciones ya aplicadas; esta fase no añade ni aplica ninguna.
2. Home sin próximo drop y sin drop estrenado en los últimos tres días: debe mostrar carrusel. Si hay productos, comprobar el orden intercalado.
3. Ver producto disponible y producto agotado: validar inventario por tallas cuando aplique; SOLD OUT conserva enlace y no muestra Disponible. No cambiar inventario de producción para probar.
4. Activar una campaña desde el panel existente del entorno de prueba: el slide Community usa sus textos. Desactivarla: muestra evergreen. CTA debe entrar al flujo /comunidad existente.
5. Abrir Instagram y TikTok: comprobar las mismas URLs del Footer y nuevas pestañas.
6. Esperar seis segundos; comprobar avance, vuelta al primero, hover/foco, pausa/reanudación y pestaña oculta.
7. Probar flechas y puntos; repetir en 320/375/390/430px con swipe horizontal, scroll vertical, CTA y textos largos. Activar reduced-motion: no autoplay/animación, controles manuales operativos.
8. Mediante Admin del entorno de prueba, configurar un producto COMING_SOON con releaseAt futuro: countdown debe reemplazar completamente el carrusel. En la ventana de un drop estrenado, sin próximo drop: live-drop debe reemplazarlo. No cambiar la ventana ni liberar productos manualmente desde esta implementación.
9. Revisar isotipo, metadata/title en navegador tras deploy/reinicio y recarga de caché. Google puede mostrar datos previos hasta su siguiente rastreo.

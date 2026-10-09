# Variantes de color e imagen promocional Home

## Datos y compatibilidad

La migración `20261008000000_product_color_variants` se entrega sin aplicar.
Agrega `Product.homeHeroImageUrl`, las tablas normalizadas `ProductColor`,
`ProductColorImage`, `ProductColorSize`, referencias opcionales al color en
`CartItem`/`OrderItem`, `OrderItem.colorName` y `CartItem.variantKey` no nullable.
No convierte productos ni altera imágenes, tallas, stock o historial existentes.
No modifica modelos ni lógica Community.

Los productos sin colores siguen utilizando `ProductImage`, `ProductSize` y
`Product.stock`. Los productos con colores utilizan exclusivamente el stock
de `ProductColorSize` para nuevas compras. Las tallas legacy se conservan para
descontar/restaurar órdenes históricas anteriores a la introducción de colores.
Para proteger el único inventario de una orden histórica sin talla, introducir
colores en un producto con órdenes sin talla devuelve 409: ese producto debe
conservarse como legacy y el nuevo producto del drop puede tener colores.

## Stock y concurrencia

`Product.stock` es el agregado de **todas** las filas de stock por color, incluso
colores desactivados. Se recalcula dentro de las transacciones de creación,
edición, descuento y restauración. El stock disponible para venta suma solamente
colores activos; los inactivos conservan su inventario para historial/restauración.
Un color activo está agotado cuando sus cuatro tallas suman cero. El producto
está agotado cuando no existe stock en sus colores activos. Nunca se utiliza
el inventario legacy como fallback cuando existen colores, aunque todos estén
desactivados.

Carrito, Admin e inventario usan transacciones Serializable, con hasta tres
reintentos después del primer intento ante conflictos P2034/P2002. La combinación
`cartId + productId + variantKey` es única y todos sus componentes son no nulos.
Las claves son `colorId:talla`, `legacy:talla` o `legacy:NONE`.
El CHECK SQL exige coherencia entre clave, color y talla. La migración rellena las
claves legacy; si el índice nullable anterior permitió duplicados, se detiene
atómicamente antes de cambios y sin quitar ninguna fila. Es necesaria su revisión
separada antes de aplicar, no una limpieza automática.

Inventario reclama `inventoryDiscounted` mediante un update condicional dentro
de la misma transacción. Descuenta mediante updates de stock condicionados a
`stock >= quantity`, exclusivamente sobre la combinación comprada, y recalcula
el agregado. Un fallo revierte todas las líneas y la marca. Cancelar incrementa
la misma combinación, incluso si el color fue desactivado. Repetir el descuento
o restauración no vuelve a modificar stock. Los callbacks concurrentes se
serializan o reintentan; no se cambia la política de cobro ni se reserva stock
antes del pago.

## Admin e imágenes

En `/admin/productos/nuevo` y edición hay una sección de colores con nombre,
HEX opcional `#RRGGBB`, activo, orden, S/M/L/XL y hasta tres imágenes por color.
Los colores nuevos se pueden quitar antes de guardar; los guardados se desactivan.
La API también desactiva colores omitidos. Los IDs de colores y filas de talla
se mantienen; las imágenes legacy conservadas mantienen sus IDs.
No se permite eliminar un producto con órdenes: devuelve 409 y debe desactivarse.

El formulario envía `expectedUpdatedAt`. Si hubo una venta, cancelación u otra
edición mientras estaba abierto, guardar devuelve 409 y solicita recargar para
evitar sobrescribir el inventario reciente.

Las imágenes reutilizan `uploadSingleFile`, `access: 'public'` y `/api/upload`.
JPG/PNG/WEBP/GIF, máximo 10 MB por archivo. La imagen promocional Home es una sola
URL opcional, con preview, reemplazo y eliminación de referencia. Quitar imágenes
no borra blobs. Se reutiliza el uploader público y se añade `maximumSizeInBytes`
al token firmado para que Blob también imponga 10 MB. No cambian su token/store
ni Blob privado/OIDC.
No se añaden variables de entorno ni dependencias.

## Detalle, carrito y órdenes

Se selecciona el primer color activo por orden que tenga stock; si todos están
agotados, el primero activo. No se selecciona talla automáticamente. Cambiar
color cambia a su galería exclusivamente, vuelve al índice cero y no hace fetch.
Conserva la talla solo si tiene stock en el nuevo color y limita la cantidad a
ese stock; si la talla no sirve, la limpia y vuelve a cantidad uno.

El servidor consulta producto/colores/tallas y exige producto habilitado según
su estado/drop, color propio activo, talla válida, cantidad entera y suficiente
stock. Nombre, precio y disponibilidad enviados por el navegador no son autoridad.
Las tarjetas abren el detalle para elegir opciones cuando hay colores/tallas.

Carrito conserva `productColorId` y distingue Crudo/M de Negro/M; actualizar y
quitar afectan solo a esa combinación. Carrito/checkout usan la miniatura del
color elegido. `OrderItem` guarda el ID y un snapshot `colorName` consultado en
servidor, que permanece aunque Admin renombre el color. Admin, listado y detalle
de Mis pedidos muestran el snapshot; órdenes legacy con null siguen funcionando.

Crear o reutilizar un checkout guarda la selección actual en OrderItem. El pago
pendiente reutilizado actualiza también sus artículos y no puede reemplazar los
de una orden ya pagada/descontada. El fallback del webhook firmado conserva
ID/nombre del color. Para que los nombres de color no excedan el límite de 500
caracteres de un valor de metadata Stripe, solo el snapshot puede dividirse en
partes. Sigue leyendo snapshots legacy. No cambian proveedor, tarjeta, precios,
cálculo de envío ni configuración de Stripe/SkydropX. La cotización de envío
solo adapta la comprobación de disponibilidad al inventario por color.

## Home

Carrusel PRODUCT y LiveDropFixedHero utilizan:

1. `homeHeroImageUrl`.
2. `Product.images[0]`.
3. Primera imagen del color default disponible/primero activo; otro color activo
   con imagen si fuese necesario. Si todos están desactivados, la primera imagen
   conservada por orden evita un hero vacío, aunque el producto siga agotado.

ProductCard y listado Admin usan la imagen principal/color y no la promoción.
Prioridad del Home intacta: `nextDrop` → countdown; si no, `recentDrop` → hero
de drop estrenado; si no, carrusel. La ventana de drop reciente sigue siendo
la definida por `lib/drop.ts` (tres días). No se cambia el contador ni se agrega
Community Early Access.

## Validación y QA manual

Prisma validate/generate y TypeScript se verificaron sin aplicar migraciones.
Las siete suites pasan: 175 pruebas (121 existentes y 54 nuevas). Incluyen las
regresiones de variantes. Lint pasa con el aviso previo de dependencia `refreshCart`.
Los tests incluyen handlers reales, componentes con eventos, snapshots y un
store transaccional simulado con conflictos/rollback. No sustituyen pruebas
manuales con PostgreSQL, Blob y Stripe reales. El build se intentó, pero el
sandbox Windows devolvió EPERM creando carpetas de `.next`.

Los pasos siguientes quedan pendientes en un entorno de prueba que tenga la
migración revisada y aplicada por separado. Esta tarea no la aplica ni hace push.

A. Abrir un producto legacy: verificar su galería/tallas, agregar, pagar en modo
   prueba, comprobar descuento y cancelar desde `/admin/ordenes` para restaurar.
B. Ir a `/admin/productos/nuevo`, completar nombre, categoría/precio y añadir
   CRUDO (`#E9E1D2`) y NEGRO (`#111111`), ambos activos.
C. Subir dos o tres imágenes distintas por color (tipos permitidos, ≤10 MB).
D. CRUDO S/M/L/XL = 2/4/3/1 y NEGRO = 1/5/2/2; comprobar total 20.
E. Guardar. Reabrir edición y comprobar colores, orden, imágenes y stock.
F. Abrir `/productos/<id>`: CRUDO default, ninguna talla seleccionada.
G. Avanzar a foto 2/3, cambiar CRUDO ↔ NEGRO: solo fotos del color elegido,
   primera foto al cambiar. Probar talla sin stock y cantidad mayor que nuevo stock.
H. Seleccionar CRUDO/M, cantidad 1, agregar al carrito.
I. Seleccionar NEGRO/M, cantidad 1, agregar al carrito.
J. Comprobar dos líneas, nombres/miniaturas propios. Cambiar cantidad y quitar
   una línea sin afectar a la otra; volver a dejar una unidad de cada color.
K. Checkout con Stripe en **modo prueba**, dirección y envío existentes; comprobar
   ambos colores en resumen. Usar tarjeta de prueba configurada para ese entorno,
   completar pago y esperar el webhook `payment_intent.succeeded`.
L. En `/mis-pedidos`, detalle y `/admin/ordenes` → Detalle: CRUDO/M y NEGRO/M.
   Renombrar CRUDO en Admin después del pago: la orden debe seguir diciendo CRUDO.
M. Reabrir el producto: CRUDO/M = 3, NEGRO/M = 4, demás tallas intactas, total 18.
   Reenviar el mismo evento de prueba: no debe descontarse de nuevo.
N. Cancelar desde Admin: CRUDO/M = 4, NEGRO/M = 5, total 20. Repetir cancelación:
   no debe incrementarse otra vez. Reabrir edición después de cada transición.
O. En edición, subir una imagen promocional Home mostrando ambos colores y guardar.
P. Para comprobar carrusel, usar producto ACTIVE sin drop reciente, sin próximo
   drop global que tome prioridad; debe aparecer la promoción en su slide PRODUCT.
Q. Quitar la imagen Home en Admin y guardar; no se borra el Blob.
R. Comprobar fallback: legacy principal si existe, si no la imagen del color default.
   ProductCard debe conservar su imagen normal durante todas las pruebas.
S. Sin próximo drop, configurar el producto ACTIVE con lanzamiento reciente dentro
   de tres días. Subir de nuevo la promoción: LiveDropFixedHero debe mostrarla.
   Quitarla para probar fallback. Con próximo drop futuro, debe aparecer únicamente
   countdown según la prioridad original.

Probar también color con todas sus tallas en cero y otro disponible; después ambos
agotados. Desactivar color usado, cancelar su orden y verificar restauración exacta.
Abrir dos editores, completar una compra y guardar el editor antiguo: debe devolver
409 sin sobrescribir stock. Cliente/visitante no puede modificar productos en Admin.

## Archivos de esta implementación

Creados:

- `components/admin/product-variant-fields.tsx`
- `docs/product-color-variants.md`
- `lib/admin/product-input.ts`
- `lib/cart-mutations.ts`
- `lib/checkout-variants.ts`
- `lib/product-queries.ts`
- `lib/product-transactions.ts`
- `lib/product-variants.ts`
- `prisma/migrations/20261008000000_product_color_variants/migration.sql`
- `tests/product-color-variants.test.cjs`

Modificados:

- `app/admin/productos/[id]/page.tsx`
- `app/admin/productos/page.tsx`
- `app/api/admin/products/[id]/route.ts`
- `app/api/admin/products/route.ts`
- `app/api/cart/add/route.ts`
- `app/api/cart/remove/route.ts`
- `app/api/cart/route.ts`
- `app/api/cart/update/route.ts`
- `app/api/shipping/quote/route.ts`
- `app/api/stripe/create-payment-intent/route.ts`
- `app/api/upload/route.ts`
- `app/api/webhooks/stripe/route.ts`
- `app/categorias/[slug]/page.tsx`
- `app/checkout/page.tsx`
- `app/mis-pedidos/[id]/page.tsx`
- `app/mis-pedidos/page.tsx`
- `app/page.tsx`
- `app/productos/[id]/page.tsx`
- `app/productos/page.tsx`
- `components/admin/orders-premium-manager.tsx`
- `components/admin/product-form.tsx`
- `components/admin/products-table.tsx`
- `components/store/cart-sheet.tsx`
- `components/store/checkout-form.tsx`
- `components/store/home-hero-switcher.tsx`
- `components/store/product-card.tsx`
- `components/store/product-detail.tsx`
- `contexts/cart-context.tsx`
- `lib/home-hero-slides.ts`
- `lib/inventory.ts`
- `prisma/schema.prisma`
- `tests/categories-admin.test.cjs`
- `tests/community-membership.test.cjs`
- `tests/home-carousel-branding.test.cjs`

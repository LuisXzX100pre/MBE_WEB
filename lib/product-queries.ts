// Include inactive colors too, so a product never falls back to legacy stock after deactivation.
export const productColorsInclude = {
  orderBy: [{ order: 'asc' as const }, { id: 'asc' as const }],
  include: { images: { orderBy: { order: 'asc' as const } }, sizeStocks: true },
}
export const cartColorInclude = { include: { images: { orderBy: { order: 'asc' as const } } } }

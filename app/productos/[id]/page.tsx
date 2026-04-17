import { notFound } from 'next/navigation'
import { Header } from '@/components/store/header'
import { Footer } from '@/components/store/footer'
import { prisma } from '@/lib/prisma'
import { ProductDetail } from '@/components/store/product-detail'

export const dynamic = 'force-dynamic'

async function getProduct(id: string) {
  return prisma.product.findFirst({
    where: {
      id,
      status: {
        in: ['ACTIVE', 'COMING_SOON'],
      },
    },
    include: {
      images: { orderBy: { order: 'asc' } },
      category: true,
      sizes: true,
    },
  })
}

async function getRelatedProducts(categoryId: string, currentId: string) {
  return prisma.product.findMany({
    where: {
      categoryId,
      id: { not: currentId },
      status: {
        in: ['ACTIVE', 'COMING_SOON'],
      },
    },
    include: {
      images: { orderBy: { order: 'asc' } },
      category: true,
      sizes: true,
    },
    take: 4,
    orderBy: { createdAt: 'desc' },
  })
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const product = await getProduct(id)

  if (!product) {
    notFound()
  }

  const relatedProducts = await getRelatedProducts(product.categoryId, product.id)

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="relative flex-1 overflow-hidden pt-24 pb-20">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-card/40" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.03),transparent_24%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:42px_42px] opacity-20" />
        <div className="absolute left-1/2 top-0 h-[280px] w-[280px] -translate-x-1/2 rounded-full bg-red-600/8 blur-3xl" />

        <div className="relative">
          <ProductDetail product={product} relatedProducts={relatedProducts} />
        </div>
      </main>

      <Footer />
    </div>
  )
}
import { notFound } from 'next/navigation'
import { Header } from '@/components/store/header'
import { Footer } from '@/components/store/footer'
import { ProductDetail } from '@/components/store/product-detail'
import { prisma } from '@/lib/prisma'

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

async function getRelatedProducts(productId: string, categoryId: string) {
  return prisma.product.findMany({
    where: {
      id: { not: productId },
      categoryId,
      status: {
        in: ['ACTIVE', 'COMING_SOON'],
      },
    },
    include: {
      images: { orderBy: { order: 'asc' } },
      category: true,
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

  const relatedProducts = await getRelatedProducts(product.id, product.categoryId)

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 pt-24 pb-20">
        <ProductDetail product={product} relatedProducts={relatedProducts} />
      </main>

      <Footer />
    </div>
  )
}
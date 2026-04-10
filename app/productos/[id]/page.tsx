// app/productos/[id]/page.tsx
import { notFound } from 'next/navigation'
import { Header } from '@/components/store/header'
import { Footer } from '@/components/store/footer'
import { prisma } from '@/lib/prisma'
import { ProductDetail } from '@/components/store/product-detail'

async function getProduct(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { order: 'asc' } },
      category: true,
      sizes: true,
    },
  })
  return product
}

async function getRelatedProducts(categoryId: string, currentId: string) {
  const products = await prisma.product.findMany({
    where: {
      categoryId,
      id: { not: currentId },
      status: 'ACTIVE',
    },
    include: {
      images: { orderBy: { order: 'asc' } },
      category: true,
    },
    take: 4,
  })
  return products
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
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 pt-24 pb-20">
        <ProductDetail product={product} relatedProducts={relatedProducts} />
      </main>

      <Footer />
    </div>
  )
}

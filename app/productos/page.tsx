import { Header } from '@/components/store/header'
import { Footer } from '@/components/store/footer'
import { ProductCard } from '@/components/store/product-card'
import { prisma } from '@/lib/prisma'

async function getProducts() {
  const products = await prisma.product.findMany({
    where: {
      status: {
        in: ['ACTIVE', 'COMING_SOON'],
      },
    },
    include: {
      images: { orderBy: { order: 'asc' } },
      category: true,
    },
    orderBy: { createdAt: 'desc' },
  })
  return products
}

async function getCategories() {
  const categories = await prisma.category.findMany()
  return categories
}

export default async function ProductsPage() {
  const products = await getProducts()
  const categories = await getCategories()

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold">Productos</h1>
            <p className="text-muted-foreground mt-2">
              Explora nuestra coleccion completa y los proximos drops
            </p>
          </div>

          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8">
              <a
                href="/productos"
                className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-full"
              >
                Todos
              </a>
              {categories.map((category) => (
                <a
                  key={category.id}
                  href={`/categorias/${category.slug}`}
                  className="px-4 py-2 bg-secondary text-secondary-foreground text-sm rounded-full hover:bg-muted transition-colors"
                >
                  {category.name}
                </a>
              ))}
            </div>
          )}

          {products.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-muted-foreground">
                No hay productos disponibles aun.
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
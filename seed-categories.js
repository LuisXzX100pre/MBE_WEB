const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const categories = [
    { name: 'Camisetas', slug: 'camisetas' },
    { name: 'Hoddies', slug: 'hoddies' },
    { name: 'Pantalones', slug: 'pantalones' },
    { name: 'Accesorios', slug: 'accesorios' },
  ]

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name },
      create: category,
    })
  }

  console.log('Categorias creadas correctamente')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
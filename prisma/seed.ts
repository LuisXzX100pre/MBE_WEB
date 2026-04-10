// prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Crear usuario admin
  const hashedPassword = await bcrypt.hash('admin123', 12)
  
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword,
      role: 'ADMIN',
    },
  })

  console.log('Admin creado:', admin.username)

  // Crear categorias
  const categories = [
    { name: 'Hoodies', slug: 'hoodies' },
    { name: 'Camisetas', slug: 'camisetas' },
    { name: 'Pantalones', slug: 'pantalones' },
    { name: 'Accesorios', slug: 'accesorios' },
  ]

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    })
  }

  console.log('Categorias creadas')

  // Crear productos de ejemplo
  const hoodiesCategory = await prisma.category.findUnique({
    where: { slug: 'hoodies' },
  })

  const camisetasCategory = await prisma.category.findUnique({
    where: { slug: 'camisetas' },
  })

  if (hoodiesCategory) {
    await prisma.product.create({
      data: {
        name: 'MBE Classic Hoodie',
        description: 'Hoodie oversize de algodon premium con logo bordado. Comodidad y estilo streetwear.',
        price: 89.99,
        stock: 50,
        categoryId: hoodiesCategory.id,
        images: {
          create: [
            {
              url: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800',
              order: 0,
            },
          ],
        },
      },
    })

    await prisma.product.create({
      data: {
        name: 'MBE Night Hoodie',
        description: 'Hoodie negro con detalles reflectantes. Ideal para el look nocturno.',
        price: 99.99,
        stock: 30,
        categoryId: hoodiesCategory.id,
        images: {
          create: [
            {
              url: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800',
              order: 0,
            },
          ],
        },
      },
    })
  }

  if (camisetasCategory) {
    await prisma.product.create({
      data: {
        name: 'MBE Logo Tee',
        description: 'Camiseta basica con logo MBE estampado. 100% algodon.',
        price: 39.99,
        stock: 100,
        categoryId: camisetasCategory.id,
        images: {
          create: [
            {
              url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800',
              order: 0,
            },
          ],
        },
      },
    })

    await prisma.product.create({
      data: {
        name: 'MBE Graphic Tee',
        description: 'Camiseta con grafico exclusivo de la temporada.',
        price: 49.99,
        stock: 75,
        categoryId: camisetasCategory.id,
        images: {
          create: [
            {
              url: 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=800',
              order: 0,
            },
          ],
        },
      },
    })
  }

  console.log('Productos de ejemplo creados')
  console.log('\n--- Credenciales Admin ---')
  console.log('Usuario: admin')
  console.log('Contraseña: admin123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

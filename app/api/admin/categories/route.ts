// app/api/admin/categories/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth'

function generateSlug(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function POST(request: Request) {
  const admin = await isAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { name } = await request.json()
    const slug = generateSlug(name)

    // Verificar si ya existe
    const existing = await prisma.category.findUnique({
      where: { slug },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe una categoria con ese nombre' },
        { status: 400 }
      )
    }

    const category = await prisma.category.create({
      data: { name, slug },
    })

    return NextResponse.json({ category })
  } catch (error) {
    console.error('Error creating category:', error)
    return NextResponse.json(
      { error: 'Error al crear categoria' },
      { status: 500 }
    )
  }
}

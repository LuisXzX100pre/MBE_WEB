import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { categoryApi, categoryBody } from '@/lib/admin/categories'

export async function GET(request: Request) {
  return categoryApi(request, async () => {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { products: true } } }, orderBy: { name: 'asc' },
    })
    return NextResponse.json({ categories })
  })
}

export async function POST(request: Request) {
  return categoryApi(request, async () => {
    const data = await categoryBody(request)
    const category = await prisma.category.create({ data, include: { _count: { select: { products: true } } } })
    return NextResponse.json({ category }, { status: 201 })
  })
}

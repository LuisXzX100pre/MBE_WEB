// app/api/cart/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ items: [] })
  }

  const cart = await prisma.cart.findUnique({
    where: { userId: user.id },
    include: {
      items: {
        include: {
          product: {
            include: {
              images: { orderBy: { order: 'asc' }, take: 1 },
            },
          },
        },
      },
    },
  })

  return NextResponse.json({ items: cart?.items || [] })
}

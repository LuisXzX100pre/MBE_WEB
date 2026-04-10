// app/api/admin/orders/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth'
import { syncInventoryByStatus } from '@/lib/inventory'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await isAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { id } = await params
    const { status } = await request.json()

    const currentOrder = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        inventoryDiscounted: true,
      },
    })

    if (!currentOrder) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }

    const order = await prisma.order.update({
      where: { id },
      data: { status },
    })

    await syncInventoryByStatus(id, status)

    const freshOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        payment: true,
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    })

    return NextResponse.json({ order: freshOrder ?? order })
  } catch (error) {
    console.error('Error updating order:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Error al actualizar orden',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await isAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { id } = await params

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        status: true,
        inventoryDiscounted: true,
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }

    if (order.status !== 'CANCELLED') {
      return NextResponse.json(
        { error: 'Solo se pueden eliminar ordenes canceladas' },
        { status: 400 }
      )
    }

    if (order.inventoryDiscounted) {
      return NextResponse.json(
        {
          error:
            'No puedes eliminar una orden cancelada que aun tiene inventario descontado',
        },
        { status: 400 }
      )
    }

    await prisma.order.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting order:', error)
    return NextResponse.json(
      { error: 'Error al eliminar orden' },
      { status: 500 }
    )
  }
}
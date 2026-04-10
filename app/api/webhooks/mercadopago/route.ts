import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { payment } from '@/lib/mercadopago'
import { syncInventoryByStatus } from '@/lib/inventory'

// ==========================
// WEBHOOK PRINCIPAL
// ==========================
export async function POST(req: Request) {
  try {
    const body = await req.json()

    console.log('[v0] Webhook MP recibido:', JSON.stringify(body, null, 2))

    const { type, topic, data, resource } = body
    const notificationType = type || topic

    console.log('[v0] Tipo de notificacion:', notificationType)

    // ==========================
    // CASO 1: PAYMENT DIRECTO
    // ==========================
    if (notificationType === 'payment') {
      const paymentId = data?.id

      if (!paymentId) {
        console.error('[v0] No payment ID')
        return NextResponse.json({ error: 'No payment ID' }, { status: 400 })
      }

      const paymentInfo = await payment?.get({ id: paymentId })

      if (!paymentInfo) {
        console.error('[v0] No se pudo obtener paymentInfo')
        return NextResponse.json({ error: 'No payment info' }, { status: 500 })
      }

      return await handlePayment(paymentInfo)
    }

    // ==========================
    // CASO 2: MERCHANT ORDER
    // ==========================
    if (notificationType === 'merchant_order') {
      if (!resource) {
        console.error('[v0] No resource URL')
        return NextResponse.json({ error: 'No resource' }, { status: 400 })
      }

      console.log('[v0] Consultando merchant_order:', resource)

      const response = await fetch(resource, {
        headers: {
          Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
        },
      })

      if (!response.ok) {
        const text = await response.text()
        console.error('[v0] Error consultando merchant_order:', response.status, text)
        return NextResponse.json(
          { error: 'No se pudo consultar merchant_order' },
          { status: 500 }
        )
      }

      const orderData = await response.json()

      console.log('[v0] Merchant order data:', JSON.stringify(orderData, null, 2))

      const paymentData = orderData.payments?.[0]

      if (!paymentData) {
        console.log('[v0] Aun no hay pagos asociados')
        return NextResponse.json({ received: true })
      }

      const paymentInfo = await payment?.get({ id: paymentData.id })

      if (!paymentInfo) {
        console.error('[v0] No se pudo obtener paymentInfo')
        return NextResponse.json({ error: 'No payment info' }, { status: 500 })
      }

      return await handlePayment(paymentInfo)
    }

    console.log('[v0] Notificacion ignorada:', notificationType)
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[v0] Error en webhook:', error)
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 })
  }
}

// ==========================
// LOGICA CENTRAL DE PAGO
// ==========================
async function handlePayment(paymentInfo: any) {
  try {
    console.log('[v0] Procesando pago:', paymentInfo.id)

    const orderId = paymentInfo.external_reference

    if (!orderId) {
      console.error('[v0] No external_reference (orderId)')
      return NextResponse.json({ error: 'No orderId' }, { status: 400 })
    }

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        inventoryDiscounted: true,
      },
    })

    if (!existingOrder) {
      console.error('[v0] Orden no encontrada:', orderId)
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }

    let paymentStatus: 'PENDING' | 'COMPLETED' | 'FAILED' = 'PENDING'
    let orderStatus:
      | 'PENDING'
      | 'PAID'
      | 'PROCESSING'
      | 'SHIPPED'
      | 'DELIVERED'
      | 'CANCELLED' = 'PENDING'

    switch (paymentInfo.status) {
      case 'approved':
        paymentStatus = 'COMPLETED'
        orderStatus = 'PAID'
        break

      case 'pending':
      case 'in_process':
        paymentStatus = 'PENDING'
        orderStatus = 'PENDING'
        break

      case 'rejected':
      case 'cancelled':
        paymentStatus = 'FAILED'
        orderStatus = 'CANCELLED'
        break

      default:
        console.log('[v0] Estado no manejado:', paymentInfo.status)
        return NextResponse.json({ received: true })
    }

    console.log('[v0] Estado MP:', paymentInfo.status)
    console.log('[v0] Estado DB:', orderStatus)

    await prisma.payment.update({
      where: { orderId },
      data: {
        status: paymentStatus,
        transactionId: String(paymentInfo.id),
      },
    })

    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: orderStatus,
      },
    })

    await syncInventoryByStatus(orderId, orderStatus)

    console.log('[v0] Orden y stock actualizados correctamente:', orderId)

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[v0] Error procesando pago:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Error procesando pago',
      },
      { status: 500 }
    )
  }
}
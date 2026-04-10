// app/api/checkout/create-preference/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getBaseUrl } from '@/lib/mercadopago'

export async function POST(request: Request) {
  try {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Mercado Pago no esta configurado correctamente' },
        { status: 500 }
      )
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { shippingAddress, phoneNumber, email } = await request.json()

    if (!shippingAddress || !phoneNumber || !email) {
      return NextResponse.json(
        { error: 'Direccion de envio, telefono y correo son requeridos' },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Formato de email invalido' },
        { status: 400 }
      )
    }

    const fullShippingInfo = `${shippingAddress}\nTel: ${phoneNumber}\nEmail: ${email}`

    const cart = await prisma.cart.findUnique({
      where: { userId: user.id },
      include: {
        items: {
          include: {
            product: {
              include: {
                sizes: true,
              },
            },
          },
        },
      },
    })

    if (!cart || cart.items.length === 0) {
      return NextResponse.json({ error: 'Carrito vacio' }, { status: 400 })
    }

    for (const item of cart.items) {
      if (item.size) {
        const sizeData = item.product.sizes.find((s) => s.size === item.size)

        if (!sizeData || sizeData.stock < item.quantity) {
          return NextResponse.json(
            {
              error: `No hay stock suficiente de ${item.product.name} talla ${item.size}`,
            },
            { status: 400 }
          )
        }
      } else {
        if (item.product.stock < item.quantity) {
          return NextResponse.json(
            {
              error: `No hay stock suficiente de ${item.product.name}`,
            },
            { status: 400 }
          )
        }
      }
    }

    const total = cart.items.reduce(
      (sum, item) => sum + item.quantity * item.product.price,
      0
    )

    const order = await prisma.order.create({
      data: {
        userId: user.id,
        total,
        status: 'PENDING',
        shippingAddress: fullShippingInfo,
        items: {
          create: cart.items.map((item) => ({
            quantity: item.quantity,
            unitPrice: item.product.price,
            size: item.size ?? undefined,
            productId: item.product.id,
          })),
        },
      },
    })

    await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: 'mercadopago',
        status: 'PENDING',
        externalReference: order.id,
        payerEmail: email,
      },
    })

    const items = cart.items.map((item) => ({
      id: item.product.id,
      title: item.size
        ? `${item.product.name} - Talla ${item.size}`
        : item.product.name,
      description: item.size
        ? `${item.product.name} - Talla ${item.size}`
        : item.product.name,
      quantity: Math.max(1, Math.floor(item.quantity)),
      unit_price: Math.round(Number(item.product.price) * 100) / 100,
      currency_id: 'MXN',
    }))

    const baseUrl = getBaseUrl()
    const isProduction =
      baseUrl.includes('vercel.app') ||
      baseUrl.includes('.com') ||
      baseUrl.includes('.net') ||
      !baseUrl.includes('localhost')

    const preferenceBody: Record<string, unknown> = {
      items,
      payer: { email },
      external_reference: order.id,
      back_urls: {
        success: `${baseUrl}/checkout/success?order_id=${order.id}`,
        failure: `${baseUrl}/checkout/failure?order_id=${order.id}`,
        pending: `${baseUrl}/checkout/pending?order_id=${order.id}`,
      },
      auto_return: 'approved',
      statement_descriptor: 'MBE STORE',
      binary_mode: false,
    }

    if (isProduction) {
      preferenceBody.notification_url = `${baseUrl}/api/webhooks/mercadopago`
    }

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preferenceBody),
    })

    const responseText = await mpResponse.text()

    if (!mpResponse.ok) {
      throw new Error(`Error de Mercado Pago (${mpResponse.status}): ${responseText}`)
    }

    const preferenceData = JSON.parse(responseText)

    await prisma.payment.update({
      where: { orderId: order.id },
      data: { preferenceId: preferenceData.id },
    })

    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    })

    return NextResponse.json({
      preferenceId: preferenceData.id,
      initPoint: preferenceData.init_point,
      sandboxInitPoint: preferenceData.sandbox_init_point,
      orderId: order.id,
    })
  } catch (error) {
    console.error('[v0] Error creando preferencia:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Error al procesar el pago. Intenta de nuevo.',
      },
      { status: 500 }
    )
  }
}
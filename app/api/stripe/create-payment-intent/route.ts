import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { getCurrentUser } from '@/lib/auth'

function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, '').slice(0, 25)
}

function amountToStripeCents(amount: number) {
  return Math.round(amount * 100)
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const shippingAddress = String(body.shippingAddress || '').trim()
    const phoneNumber = String(body.phoneNumber || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const cardholderName = String(body.cardholderName || '').trim()

    if (!shippingAddress || !phoneNumber || !email || !cardholderName) {
      return NextResponse.json(
        {
          error:
            'Direccion de envio, telefono, correo y nombre del titular son requeridos',
        },
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

    if (total <= 0) {
      return NextResponse.json(
        { error: 'El total del pedido es invalido' },
        { status: 400 }
      )
    }

    const cartSnapshot = cart.items.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
      unitPrice: item.product.price,
      size: item.size ?? null,
    }))

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountToStripeCents(total),
      currency: 'mxn',
      payment_method_types: ['card'],
      receipt_email: email,
      description: `Checkout MBE ${user.id}`,
      metadata: {
        userId: user.id,
        email,
        shippingAddress,
        phoneNumber: normalizePhone(phoneNumber),
        cardholderName,
        cartSnapshot: JSON.stringify(cartSnapshot),
      },
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    })
  } catch (error) {
    console.error('[stripe:create-payment-intent]', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo iniciar el pago con Stripe',
      },
      { status: 500 }
    )
  }
}
// lib/order-status-messages.ts

export type OrderStatusMessageContext = {
  orderId: string
  status: string
  customerName: string
  isLocalDelivery: boolean
  shippingCarrier?: string | null
  shippingService?: string | null
  shippingTrackingNumber?: string | null
  shippingTrackingUrl?: string | null
  appUrl?: string
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function shortOrderId(orderId: string) {
  return orderId.slice(0, 8)
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'PENDING':
      return 'Pendiente'
    case 'CONFIRMED':
      return 'Confirmado'
    case 'PAID':
      return 'Pagado'
    case 'PROCESSING':
      return 'Procesando'
    case 'SHIPPED':
      return 'En camino'
    case 'DELIVERED':
      return 'Entregado'
    case 'CANCELLED':
      return 'Cancelado'
    default:
      return status
  }
}

function buildHeadline(ctx: OrderStatusMessageContext) {
  switch (ctx.status) {
    case 'PENDING':
      return 'Recibimos tu pedido y esta pendiente.'
    case 'CONFIRMED':
      return 'Tu pedido fue confirmado y estamos validando el pago.'
    case 'PAID':
      return 'Tu pago fue confirmado correctamente.'
    case 'PROCESSING':
      return ctx.isLocalDelivery
        ? 'Estamos preparando tu pedido para entrega local.'
        : 'Estamos preparando tu pedido para enviarlo.'
    case 'SHIPPED':
      return ctx.isLocalDelivery
        ? 'Tu pedido ya va en camino con entrega local MBE.'
        : 'Tu pedido ya fue enviado.'
    case 'DELIVERED':
      return ctx.isLocalDelivery
        ? 'Tu pedido fue entregado por MBE.'
        : 'Tu pedido fue entregado correctamente.'
    case 'CANCELLED':
      return 'Tu pedido fue cancelado.'
    default:
      return `Tu pedido fue actualizado a ${getStatusLabel(ctx.status)}.`
  }
}

function buildExtra(ctx: OrderStatusMessageContext) {
  if (ctx.status === 'SHIPPED' && !ctx.isLocalDelivery) {
    const tracking = ctx.shippingTrackingNumber
      ? `Numero de rastreo: ${ctx.shippingTrackingNumber}.`
      : ''
    const carrier = ctx.shippingCarrier || ctx.shippingService
      ? `Paqueteria: ${ctx.shippingCarrier || ''}${ctx.shippingService ? ` · ${ctx.shippingService}` : ''}.`
      : ''
    return [carrier, tracking].filter(Boolean).join(' ')
  }

  if (ctx.status === 'SHIPPED' && ctx.isLocalDelivery) {
    return 'Nuestro equipo local lo lleva hacia ti dentro de Benito Juarez, Quintana Roo.'
  }

  if (ctx.status === 'PROCESSING' && ctx.isLocalDelivery) {
    return 'Te avisaremos cuando salga a reparto.'
  }

  if (ctx.status === 'DELIVERED') {
    return 'Gracias por comprar en MBE.'
  }

  if (ctx.status === 'CANCELLED') {
    return 'Si tienes dudas, contactanos para revisar tu caso.'
  }

  return ''
}

function buildShortSms(ctx: OrderStatusMessageContext, orderUrl: string) {
  const id = shortOrderId(ctx.orderId)
  const link = orderUrl ? ` ${orderUrl}` : ''

  switch (ctx.status) {
    case 'PENDING':
      return `MBE ${id} pendiente.${link}`
    case 'CONFIRMED':
      return `MBE ${id} confirmado.${link}`
    case 'PAID':
      return `MBE ${id} pagado.${link}`
    case 'PROCESSING':
      return `MBE ${id} en preparacion.${link}`
    case 'SHIPPED':
      return ctx.isLocalDelivery
        ? `MBE ${id} en camino.${link}`
        : `MBE ${id} enviado.${link}`
    case 'DELIVERED':
      return `MBE ${id} entregado.${link}`
    case 'CANCELLED':
      return `MBE ${id} cancelado.${link}`
    default:
      return `MBE ${id} actualizado.${link}`
  }
}

export function getOrderStatusMessages(ctx: OrderStatusMessageContext) {
  const label = getStatusLabel(ctx.status)
  const headline = buildHeadline(ctx)
  const extra = buildExtra(ctx)
  const orderUrl = ctx.appUrl
    ? `${ctx.appUrl.replace(/\/$/, '')}/mis-pedidos/${ctx.orderId}`
    : ''

  const subject = `MBE · Pedido #${shortOrderId(ctx.orderId)} · ${label}`

  const text = [
    `Hola ${ctx.customerName},`,
    '',
    headline,
    extra,
    orderUrl ? `Ver pedido: ${orderUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const sms = buildShortSms(ctx, orderUrl)

  const html = `
    <div style="background:#050505;padding:32px 20px;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
      <div style="max-width:640px;margin:0 auto;background:#0f0f10;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
        <div style="padding:28px 28px 18px;border-bottom:1px solid rgba(255,255,255,0.08);">
          <div style="font-size:12px;letter-spacing:0.35em;text-transform:uppercase;color:rgba(255,255,255,0.45);">MBE</div>
          <h1 style="margin:14px 0 8px;font-size:28px;line-height:1.1;color:#ffffff;">Actualizacion de tu pedido</h1>
          <p style="margin:0;color:rgba(255,255,255,0.65);font-size:15px;">
            Pedido #${escapeHtml(shortOrderId(ctx.orderId))}
          </p>
        </div>

        <div style="padding:28px;">
          <p style="margin:0 0 14px;font-size:16px;color:#ffffff;">Hola ${escapeHtml(ctx.customerName)},</p>

          <div style="margin:0 0 18px;padding:16px 18px;border-radius:16px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);">
            <p style="margin:0;font-size:16px;font-weight:700;color:#ffffff;">${escapeHtml(headline)}</p>
          </div>

          ${
            extra
              ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.78);">${escapeHtml(extra)}</p>`
              : ''
          }

          ${
            !ctx.isLocalDelivery && ctx.shippingTrackingUrl
              ? `<p style="margin:0 0 20px;">
                  <a href="${escapeHtml(
                    ctx.shippingTrackingUrl
                  )}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#ffffff;color:#000000;text-decoration:none;font-weight:700;">
                    Ver rastreo
                  </a>
                </p>`
              : ''
          }

          ${
            orderUrl
              ? `<p style="margin:0 0 20px;">
                  <a href="${escapeHtml(
                    orderUrl
                  )}" style="display:inline-block;padding:12px 18px;border-radius:999px;border:1px solid rgba(255,255,255,0.14);color:#ffffff;text-decoration:none;font-weight:700;">
                    Ver mi pedido
                  </a>
                </p>`
              : ''
          }

          <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:rgba(255,255,255,0.48);">
            Este mensaje fue enviado automaticamente por MBE para mantenerte al tanto del estado de tu compra.
          </p>
        </div>
      </div>
    </div>
  `

  return {
    subject,
    text,
    html,
    sms,
  }
}
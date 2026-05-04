// lib/order-status-notifications.ts

import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'
import twilio from 'twilio'
import { getOrderStatusMessages } from '@/lib/order-status-messages'

const resend =
  process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null

function normalizePhoneForSms(phone: string | null | undefined) {
  if (!phone) return null

  const raw = phone.trim()

  if (raw.startsWith('+')) {
    return raw.replace(/[^\d+]/g, '')
  }

  const digits = raw.replace(/\D/g, '')

  if (digits.length === 10) {
    return `+52${digits}`
  }

  if (digits.length === 12 && digits.startsWith('52')) {
    return `+${digits}`
  }

  if (digits.length === 13 && digits.startsWith('521')) {
    return `+${digits}`
  }

  return null
}

function isLocalDelivery(order: {
  shippingRateId?: string | null
  shippingCarrier?: string | null
}) {
  return (
    order.shippingRateId === 'mbe-local-benito-juarez-free' ||
    order.shippingCarrier === 'mbe-local' ||
    order.shippingCarrier === 'Entrega local MBE'
  )
}

export async function sendOrderStatusNotifications(input: {
  orderId: string
  previousStatus?: string | null
  nextStatus: string
}) {
  const previousStatus = input.previousStatus?.trim().toUpperCase() || null
  const nextStatus = input.nextStatus.trim().toUpperCase()

  if (previousStatus === nextStatus) {
    return { skipped: true, reason: 'same_status' }
  }

  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: {
      payment: {
        select: {
          payerEmail: true,
        },
      },
      user: {
        select: {
          username: true,
          email: true,
          phone: true,
        },
      },
    },
  })

  if (!order) {
    return { skipped: true, reason: 'order_not_found' }
  }

  const recipientEmail =
    order.shippingEmail ||
    order.payment?.payerEmail ||
    order.user?.email ||
    null

  const recipientPhone = normalizePhoneForSms(
    order.shippingPhone || order.user?.phone || null
  )

  const appUrl = process.env.APP_URL?.replace(/\/$/, '') || ''
  const localDelivery = isLocalDelivery(order as any)

  const messages = getOrderStatusMessages({
    orderId: order.id,
    status: nextStatus,
    customerName: order.shippingFullName || order.user?.username || 'Cliente',
    isLocalDelivery: localDelivery,
    shippingCarrier: order.shippingCarrier,
    shippingService: order.shippingService,
    shippingTrackingNumber: order.shippingTrackingNumber,
    shippingTrackingUrl: order.shippingTrackingUrl,
    appUrl,
  })

  const result = {
    skipped: false,
    email: 'not_sent',
    sms: 'not_sent',
  }

  if (resend && process.env.EMAIL_FROM && recipientEmail) {
    try {
      await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: [recipientEmail],
        subject: messages.subject,
        html: messages.html,
        text: messages.text,
      })

      result.email = 'sent'
    } catch (error) {
      console.error('[notifications:email]', error)
      result.email = 'failed'
    }
  } else {
    result.email = 'skipped'
  }

  if (
    twilioClient &&
    process.env.TWILIO_MESSAGING_SERVICE_SID &&
    recipientPhone
  ) {
    try {
      await twilioClient.messages.create({
        body: messages.sms,
        messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
        to: recipientPhone,
      })

      result.sms = 'sent'
    } catch (error) {
      console.error('[notifications:sms]', error)
      result.sms = 'failed'
    }
  } else {
    result.sms = 'skipped'
  }

  return result
}
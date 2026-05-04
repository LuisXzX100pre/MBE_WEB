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

function maskEmail(email: string | null | undefined) {
  if (!email) return null

  const [name, domain] = email.split('@')
  if (!domain) return email

  const safeName =
    name.length <= 2 ? `${name[0] ?? '*'}*` : `${name.slice(0, 2)}***`

  return `${safeName}@${domain}`
}

function maskPhone(phone: string | null | undefined) {
  if (!phone) return null

  const digits = phone.replace(/\D/g, '')
  if (digits.length <= 4) return phone

  return `***${digits.slice(-4)}`
}

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

function extractTwilioError(error: unknown) {
  if (!(error instanceof Error)) {
    return { message: 'unknown_error' }
  }

  const maybe = error as Error & {
    code?: number | string
    status?: number
    moreInfo?: string
    details?: unknown
  }

  return {
    name: maybe.name,
    message: maybe.message,
    code: maybe.code,
    status: maybe.status,
    moreInfo: maybe.moreInfo,
    details: maybe.details ?? null,
  }
}

export async function sendOrderStatusNotifications(input: {
  orderId: string
  previousStatus?: string | null
  nextStatus: string
}) {
  const previousStatus = input.previousStatus?.trim().toUpperCase() || null
  const nextStatus = input.nextStatus.trim().toUpperCase()

  console.log('[notifications:start]', {
    orderId: input.orderId,
    previousStatus,
    nextStatus,
    hasResend: Boolean(process.env.RESEND_API_KEY),
    hasEmailFrom: Boolean(process.env.EMAIL_FROM),
    hasTwilioSid: Boolean(process.env.TWILIO_ACCOUNT_SID),
    hasTwilioToken: Boolean(process.env.TWILIO_AUTH_TOKEN),
    hasTwilioMessagingServiceSid: Boolean(
      process.env.TWILIO_MESSAGING_SERVICE_SID
    ),
    vercelEnv: process.env.VERCEL_ENV || null,
  })

  if (previousStatus === nextStatus) {
    console.log('[notifications:skip]', {
      orderId: input.orderId,
      reason: 'same_status',
    })

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
    console.log('[notifications:skip]', {
      orderId: input.orderId,
      reason: 'order_not_found',
    })

    return { skipped: true, reason: 'order_not_found' }
  }

  const emailSource = order.shippingEmail
    ? 'shippingEmail'
    : order.payment?.payerEmail
      ? 'payment.payerEmail'
      : order.user?.email
        ? 'user.email'
        : null

  const phoneSource = order.shippingPhone
    ? 'shippingPhone'
    : order.user?.phone
      ? 'user.phone'
      : null

  const rawPhone = order.shippingPhone || order.user?.phone || null

  const recipientEmail =
    order.shippingEmail ||
    order.payment?.payerEmail ||
    order.user?.email ||
    null

  const recipientPhone = normalizePhoneForSms(rawPhone)

  const appUrl = process.env.APP_URL?.replace(/\/$/, '') || ''
  const localDelivery = isLocalDelivery(order as any)

  console.log('[notifications:targets]', {
    orderId: order.id,
    emailSource,
    phoneSource,
    shippingPhone: maskPhone(order.shippingPhone),
    userPhone: maskPhone(order.user?.phone),
    rawPhoneChosen: maskPhone(rawPhone),
    normalizedPhone: maskPhone(recipientPhone),
    recipientEmail: maskEmail(recipientEmail),
    localDelivery,
  })

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
      console.log('[notifications:email:attempt]', {
        orderId: order.id,
        to: maskEmail(recipientEmail),
        subject: messages.subject,
      })

      const response = await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: [recipientEmail],
        subject: messages.subject,
        html: messages.html,
        text: messages.text,
      })

      console.log('[notifications:email:success]', {
        orderId: order.id,
        to: maskEmail(recipientEmail),
        resendId: response.data?.id || null,
      })

      result.email = 'sent'
    } catch (error) {
      console.error('[notifications:email:failed]', {
        orderId: order.id,
        to: maskEmail(recipientEmail),
        error:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : error,
      })

      result.email = 'failed'
    }
  } else {
    console.log('[notifications:email:skip]', {
      orderId: order.id,
      hasResendClient: Boolean(resend),
      hasEmailFrom: Boolean(process.env.EMAIL_FROM),
      hasRecipientEmail: Boolean(recipientEmail),
    })

    result.email = 'skipped'
  }

  if (
    twilioClient &&
    process.env.TWILIO_MESSAGING_SERVICE_SID &&
    recipientPhone
  ) {
    try {
      console.log('[notifications:sms:attempt]', {
        orderId: order.id,
        phoneSource,
        to: maskPhone(recipientPhone),
        messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
        status: nextStatus,
      })

      const sms = await twilioClient.messages.create({
        body: messages.sms,
        messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
        to: recipientPhone,
      })

      console.log('[notifications:sms:success]', {
        orderId: order.id,
        phoneSource,
        to: maskPhone(recipientPhone),
        sid: sms.sid,
        status: sms.status,
        errorCode: sms.errorCode,
        errorMessage: sms.errorMessage,
      })

      result.sms = 'sent'
    } catch (error) {
      console.error('[notifications:sms:failed]', {
        orderId: order.id,
        phoneSource,
        to: maskPhone(recipientPhone),
        twilio: extractTwilioError(error),
      })

      result.sms = 'failed'
    }
  } else {
    console.log('[notifications:sms:skip]', {
      orderId: order.id,
      phoneSource,
      hasTwilioClient: Boolean(twilioClient),
      hasMessagingServiceSid: Boolean(process.env.TWILIO_MESSAGING_SERVICE_SID),
      hasRecipientPhone: Boolean(recipientPhone),
      shippingPhone: maskPhone(order.shippingPhone),
      userPhone: maskPhone(order.user?.phone),
      rawPhoneChosen: maskPhone(rawPhone),
      normalizedPhone: maskPhone(recipientPhone),
    })

    result.sms = 'skipped'
  }

  console.log('[notifications:done]', {
    orderId: order.id,
    result,
  })

  return result
}
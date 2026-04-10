import Stripe from 'stripe'

const globalForStripe = globalThis as unknown as {
  stripe: Stripe | undefined
}

const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim()

if (!stripeSecretKey) {
  throw new Error('Falta STRIPE_SECRET_KEY')
}

export const stripe =
  globalForStripe.stripe ??
  new Stripe(stripeSecretKey, {
    apiVersion: '2026-03-25.dahlia',
  })

if (process.env.NODE_ENV !== 'production') {
  globalForStripe.stripe = stripe
}
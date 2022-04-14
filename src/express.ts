import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import Stripe from 'stripe'

export const app = express()

dotenv.config()

app.use(express.json())

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2020-08-27',
})

const allowedOriginsStr = process.env.CORS_ALLOWED_ORIGINS || ''
const allowedOrigins = allowedOriginsStr.split(',')
const corsOpts = {
  origin: allowedOrigins,
}
app.use(cors(corsOpts))

/**
 * Health endpoint to ensure that the server is running as expected
 */
app.get('/healthz', async (req, res) => {
  res.status(200).json({ message: 'success' })
})

app.get('/oauth/notion', (req, res) => {
  console.log('oauthNotion fired dawg!')
  res.send('hello!')
})

app.get('/oauth/notion/callback', (req, res) => {
  res.send('hello!')
})

app.post('/create-checkout-session', async (req, res) => {
  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price: process.env.STRIPE_PRICE_ID,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: `${process.env.FRONTEND_URL}/post-checkout`,
    cancel_url: `${process.env.FRONTEND_URL}/checkout-failed`,
  })

  return res.status(200).json({ sessionUrl: session.url })
})

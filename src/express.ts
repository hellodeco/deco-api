import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import fetch from 'node-fetch'
import { v4 as uuid }  from 'uuid'
import Stripe from 'stripe'
import {
  SERVER_BASE_URL,
  NOTION_BASE_URL,
  FRONTEND_BASE_URL,
} from './constants';

export const app = express()

const NOTION_AUTH_COOKIE_STATE_KEY = 'notion-auth-state'

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
  const state = uuid()
  const params = new URLSearchParams({
    client_id: process.env.NOTION_CLIENT_ID,
    redirect_uri: `${SERVER_BASE_URL}/oauth/notion/callback`,
    response_type: 'code',
    owner: 'user',
    state,
  })

  const reqUrl = new URL(`${NOTION_BASE_URL}/v1/oauth/authorize`)
  reqUrl.search = params.toString()

  res.cookie(NOTION_AUTH_COOKIE_STATE_KEY, state, {
    httpOnly: process.env.NODE_ENV === 'production'
  })

  res.redirect(reqUrl.toString())
})

app.get('/oauth/notion/callback', async (req, res) => {
  /**
   * @todo handle the case that the user denies the notion integration access
   * in which case they will be directed back here with an `error` as documented
   * here: https://developers.notion.com/docs/authorization
   * also see:
   * - https://developers.notion.com/docs/authorization#user-authorization-failures
   * - https://developers.notion.com/docs/authorization#token-request-failures
   */

  const { code, state } = req.query
  const prevState = req.cookies.state
  res.clearCookie(NOTION_AUTH_COOKIE_STATE_KEY)

  if (prevState !== state) {
    res.status(403).send({
      success: false,
      message: 'not authorized',
    })
  }

  const tokenUrl = new URL(`${NOTION_BASE_URL}/v1/oauth/token`)
  // tokenUrl.search = params.toString()

  let notionBasicAuth = `${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`
  notionBasicAuth = Buffer.from(notionBasicAuth).toString('base64')


  const tokenReqBody = {
    code,
    grant_type: 'authorization_code',
    redirect_uri: `${SERVER_BASE_URL}/oauth/notion/callback`,
  }
  
  const tokenRes = await fetch(tokenUrl.toString(), {
    method: 'post',
    headers: {
      Authorization: `Basic ${notionBasicAuth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(tokenReqBody)
  })

  const {
    // @ts-ignore
    access_token,
    // @ts-ignore
    workspace_id,
    // @ts-ignore
    workspace_name,
    // @ts-ignore
    workspace_icon,
    // @ts-ignore
    bot_id,
    // @ts-ignore
    owner,
  } = await tokenRes.json()

  console.log({
    access_token,
    workspace_id,
    workspace_name,
    workspace_icon,
    bot_id,
    owner,
  })

  res.redirect(`${FRONTEND_BASE_URL}/auth/notion/success`)
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

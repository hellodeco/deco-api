import express from 'express'
import cookieParser from 'cookie-parser'
import dotenv from 'dotenv'
import cors from 'cors'
import fetch from 'node-fetch'
import { v4 as uuid } from 'uuid'
import Stripe from 'stripe'
import {
  createOrUpdateNotionIntegration,
  getUserMetaByUserfrontID,
} from './db-access/db-access'
import { verifyJWT } from './jwt'
import {
  SERVER_BASE_URL,
  NOTION_BASE_URL,
  FRONTEND_BASE_URL,
} from './constants'
import { handleStripeWebhook } from './express-handlers/stripe-webhook'
import {
  getNotionRedirectURI,
  createNotionAuthFailedRedirectURL,
} from './utils'

export const app = express()

// this endpoint needs to run before other parsing middleware is run because Stripe is a huge diva and relies on raw body data
app.post(
  '/stripe/webhook',
  express.raw({ type: 'application/json' }),
  handleStripeWebhook,
)

app.use(cookieParser())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Set some headers to help with cross-origin cookies
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', 'true')
  res.header('Access-Control-Allow-Origin', req.headers.origin)
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
  res.header(
    'Access-Control-Allow-Headers',
    'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept',
  )
  next()
})

const NOTION_AUTH_COOKIE_STATE_KEY = 'notion-auth-state'
const AUTH_TOKEN_COOKIE_STATE_KEY = 'auth-token'

dotenv.config()

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
 * Health endpoint to ensure that the server is running as expected.
 * This is used by our hosting provided, Render and the exact endpoint it queries
 * can be configured in the Render settings for this deployed service
 */
app.get('/healthz', async (req, res) => {
  res.status(200).json({ message: 'success' })
})

app.get('/oauth/notion', async (req, res) => {
  const { authToken } = req.query

  if (!authToken) {
    return res.redirect(createNotionAuthFailedRedirectURL({
      message: 'error: unable to authenticate with notion. auth token not provided',
    }))
    // return res.redirect(`${FRONTEND_BASE_URL}/auth/notion/failed`)
    // return res.status(403).json({
    //   success: false,
    //   message: 'error: unable to authenticate with notion. auth token not provided',
    // })
  }

  const state = uuid()
  const params = new URLSearchParams({
    client_id: process.env.NOTION_CLIENT_ID,
    redirect_uri: getNotionRedirectURI(),
    response_type: 'code',
    owner: 'user',
    state,
  })

  const reqUrl = new URL(`${NOTION_BASE_URL}/v1/oauth/authorize`)
  reqUrl.search = params.toString()

  res.cookie(AUTH_TOKEN_COOKIE_STATE_KEY, authToken, {
    httpOnly: process.env.NODE_ENV === 'production',
  })

  res.cookie(NOTION_AUTH_COOKIE_STATE_KEY, state, {
    httpOnly: process.env.NODE_ENV === 'production',
  })

  res.redirect(reqUrl.toString())
})

app.get('/oauth/notion/callback', async (req, res) => {
  const { code, state, error } = req.query
  const prevState = req.cookies[NOTION_AUTH_COOKIE_STATE_KEY]
  const authToken = req.cookies[AUTH_TOKEN_COOKIE_STATE_KEY]

  res.clearCookie(NOTION_AUTH_COOKIE_STATE_KEY)
  res.clearCookie(AUTH_TOKEN_COOKIE_STATE_KEY)

  /**
   * if req.query.error exists, then the user denied access to the integration
   * @reference https://developers.notion.com/docs/authorization#user-authorization-failures
   * @reference https://developers.notion.com/docs/authorization#token-request-failures
   */
  if (error || prevState !==  state) {
    return res.redirect(createNotionAuthFailedRedirectURL({
      message: 'access denied',
    }))
  }

  try {
    const { userfrontID } = await verifyJWT(authToken)
    const userMeta = await getUserMetaByUserfrontID(userfrontID)

    if (!userMeta) {
      return res.redirect(createNotionAuthFailedRedirectURL({
        message: 'could not authenticate',
      }))
    }

    const tokenUrl = new URL(`${NOTION_BASE_URL}/v1/oauth/token`)

    let notionBasicAuth = `${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`
    notionBasicAuth = Buffer.from(notionBasicAuth).toString('base64')

    const tokenReqBody = {
      code,
      grant_type: 'authorization_code',
      redirect_uri: getNotionRedirectURI(),
    }

    const tokenRes = await fetch(tokenUrl.toString(), {
      method: 'post',
      headers: {
        Authorization: `Basic ${notionBasicAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tokenReqBody),
    })

    const json = await tokenRes.json()

    const {
      access_token,
      token_type,
      workspace_id,
      workspace_name,
      workspace_icon,
      bot_id,
      owner,
      error: tokenError,
    } = json

    if (tokenError) {
      return res.redirect(createNotionAuthFailedRedirectURL({
        message: 'unable to authenticate with notion',
      }))
    }

    await createOrUpdateNotionIntegration({
      userfrontUserId: userMeta.userfrontUserId,
      accessToken: access_token,
      tokenType: token_type,
      workspaceId: workspace_id,
      workspaceName: workspace_name,
      workspaceIcon: workspace_icon,
      botId: bot_id,
      userId: owner?.user?.id,
      userFullName: owner?.user?.name,
      avatarURL: owner?.user?.avatar_url,
      type: owner?.user?.type,
      email: owner?.user?.person?.email,
    })

    return res.redirect('${FRONTEND_BASE_URL}/auth/notion/success')
  } catch (err) {
    console.error(err)
    return res.redirect(createNotionAuthFailedRedirectURL({
      message: 'failed to connect to notion',
    }))
  }
})

app.post('/stripe/checkout-session', async (req, res) => {
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

import express from 'express'
import cookieParser from 'cookie-parser'
import bodyParser from 'body-parser';
import dotenv from 'dotenv'
import cors from 'cors'
import fetch from 'node-fetch'
import { v4 as uuid }  from 'uuid'
import Stripe from 'stripe'
import { createNotionIntegration, getUserMetaByUserfrontID } from './db-access/db-access'
import { verifyJWT } from './jwt'
import {
  SERVER_BASE_URL,
  NOTION_BASE_URL,
  FRONTEND_BASE_URL,
} from './constants';

export const app = express()

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(cookieParser())
app.use(express.urlencoded({ extended: true}))

// Set some headers to help with cross-origin cookies
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', 'true')
  res.header('Access-Control-Allow-Origin', req.headers.origin)
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
  res.header('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept')
  next()
})

const NOTION_AUTH_COOKIE_STATE_KEY = 'notion-auth-state'
const AUTH_TOKEN_COOKIE_STATE_KEY = 'auth-token'

/**
https://veryspry.ngrok.io/oauth/notion?authToken=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjdlM2Y3NWRjLTcyZjMtNGMwYy1hZjZlLWVhMDU1Zjg4NGJkZiJ9.eyJtb2RlIjoidGVzdCIsInRlbmFudElkIjoid245NXA2bjUiLCJ1c2VySWQiOjYxLCJ1c2VyVXVpZCI6ImVmZDI5NTRjLTM0OTMtNGQzZC05OWVhLWUyNWY4MmRlZmQzZiIsImlzQ29uZmlybWVkIjpmYWxzZSwiYXV0aG9yaXphdGlvbiI6e30sImlzcyI6InVzZXJmcm9udCIsInNlc3Npb25JZCI6ImI0NGJmOGI1LWQwOWYtNDBkZi1hMTk3LTUwNDVlZWE5MDQwYSIsImlhdCI6MTY0OTk3MjQwNywiZXhwIjoxNjUwNTc3MjA3fQ.YM-ut1UrNnLpne4QCnrHi_GojzePC3VGGzTs5ZLJaxAIOAR15fckPHa6CS_9pA5HqOGrSp7Q_4S_epMpuCTKWE43DwSxFej9er-CUXvteHsPz7CkGd0_k5CYvNdtqn8aHkg0NpMOvXS_OF2hr2dHHBH4S0yPjpvAFxYUhIHEWijbZrG_r5GErRGVvVbGkNG4w3ek-6nWz7ZBCxD3UfIWUoGil5NZXNcB-2ppyBcskXr6xdYmBDTTwlXHhodvdhNkSq4Q_hp2tWtdxDLz2M_Wfr8M5uvnmgvhbuv2agPEHmXxT3sGCNPGYvp43l71OTy9Xn14MTPgRr1OXP0loLxo-XiLHY6oj9_Vm3lVyc4JlGveLWNc1etMYW23C0AljJURLWG7duu5KVR4SG7foBu1m2P_ug6O_6C3yfppiGCHHQqiRoGWe3DJdhm11CHYlyZdjkyyIcvwBCkhbNyRmmVe1iGgTyC7xNgJ5YVLD_EtXBjokZfoAwCkNfEA42CNhgQh_pM_ET9qP2knHs7u-IWa--EcnFO1cq6yjAGtkHWOZUuym96SAELXdM4Ol6Px1NW52P9-VY6b6ypZONEpgzE01BEKghpddgX0jyQQtAp3UXlz0MdTXjbD6BB4qZGtSA6PEiaOhtaf5VnAGWjXQHxm7EKROhOSJJKq4VlO7_zgU_k
*/

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

app.get('/oauth/notion', async (req, res) => {
  const { authToken } = req.query
  
  if (!authToken) {
    return res.status(403).json({
      success: false,
      message: 'unable to authenticate with notion',
    })
  }

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

  res.cookie(AUTH_TOKEN_COOKIE_STATE_KEY, authToken, {
    httpOnly: process.env.NODE_ENV === 'production',
  })

  res.cookie(NOTION_AUTH_COOKIE_STATE_KEY, state, {
    httpOnly: process.env.NODE_ENV === 'production',
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
  const prevState = req.cookies[NOTION_AUTH_COOKIE_STATE_KEY]
  const authToken = req.cookies[AUTH_TOKEN_COOKIE_STATE_KEY]

  res.clearCookie(NOTION_AUTH_COOKIE_STATE_KEY)
  res.clearCookie(AUTH_TOKEN_COOKIE_STATE_KEY)

  if (prevState !== state) {
    return res.status(403).send({
      success: false,
      message: 'not authorized',
    })
  }

  const tokenUrl = new URL(`${NOTION_BASE_URL}/v1/oauth/token`)

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

  const { userfrontID } = await verifyJWT(authToken)
  const userMeta = await getUserMetaByUserfrontID(userfrontID)

  if (!userMeta) {
    return res.status(403).json({
      message: 'could not authenticate',
      success: false,
    })
  }

  const json = await tokenRes.json()

  const {
    access_token,
    token_type,
    workspace_id,
    workspace_name,
    workspace_icon,
    bot_id,
    owner,
  } = json

  await createNotionIntegration({
	  userfrontUserID: userMeta.userfrontUserID,
	  accessToken: access_token,
    tokenType: token_type,
	  workspaceID: workspace_id,
	  workspaceName: workspace_name,
	  workspaceIcon: workspace_icon,
	  botID: bot_id,
	  userID: owner?.user?.id,
	  userFullName: owner?.user?.name,
	  avatarURL: owner?.user?.avatar_url,
	  type: owner?.user?.type,
	  email: owner?.user?.person?.email,
  })

  // res.redirect(`${FRONTEND_BASE_URL}/auth/notion/success`)
  res.send('success!')
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

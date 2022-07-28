import express from 'express'
import type { Request, Response } from 'express'
import path from 'path'
import fs from 'fs'
import stream from 'stream'
import type { Express } from 'express'
import cookieParser from 'cookie-parser'
import dotenv from 'dotenv'
import cors from 'cors'
import fetch from 'node-fetch'
import multer from 'multer'
import { v4 as uuid } from 'uuid'
import Stripe from 'stripe'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import {
  getUserByUserfrontID,
  getSubscriptionByUserfrontUserId,
} from './db-access/db-access'
import { verifyJWT } from './jwt'
import {
  NOTION_BASE_URL,
  FRONTEND_BASE_URL,
  IS_LOCAL,
  NOTION_REDIRECT_URI,
  USERFRONT_READONLY_API_KEY,
} from './constants'
import { handleStripeWebhook } from './express-handlers/stripe-webhook'
import { emailReceiveHandler } from './express-handlers/sendgrid'
import { db } from './db-connection'
import { objectCamelToSnake } from './utils'
import { multerS3 } from './uploads/multer-storage-engine-s3'
import s3Client from './s3-client'
import type { NotionIntegration } from './types/database'

function createNotionAuthFailedRedirectURL({ message }: { message: string }) {
  const params = new URLSearchParams()
  params.append('message', message)
  return `${FRONTEND_BASE_URL}/oauth/notion/fail?${params.toString()}`
}

export async function upsertNotionIntegration(
  notionIntegration: NotionIntegration,
) {
  const integration = await db
    .notionIntegrations()
    .where('userfront_user_id', notionIntegration.userfrontUserId)
    .select('id')
    .first()

  if (integration) {
    const [newIntegration] = await db
      .notionIntegrations()
      .where('userfront_user_id', notionIntegration.userfrontUserId)
      .update(objectCamelToSnake(notionIntegration))
      .returning('id')

    return newIntegration
  }

  const [newIntegration] = await db
    .notionIntegrations()
    .insert(objectCamelToSnake(notionIntegration))
    .returning('id')

  return newIntegration
}

export function addRoutes(app: Express) {
  const upload = multer({
    // can't use this rn because req.body is not always fully populated before it is used
    // to process each file and we need req.body.attachment-info (as given to us by Sendgrid)
    // to use this because we need the file size before uploading to S3
    // storage: multerS3(),
    fileFilter: (req, file, cb) => {
      // ignore all files
      // cb(null, false)

      // TODO: do we need to reject some files here?
      cb(null, true)
    },
  })

  // this endpoint needs to be added before other parsing middleware is added because Stripe is a huge diva and relies on raw body data
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
    let status = 200
    let body: {
      databaseMessage?: string
      userfronAPIMessage?: string
    } = {
      databaseMessage: 'database is alive and responding',
      userfronAPIMessage: 'userfront API is alive and responding',
    }

    const user = db.users().select('id').first()

    if (!user) {
      status = 500
      body.databaseMessage = 'Database is not connected'
    }

    const userfrontResp = await fetch(
      'https://api.userfront.com/v0/users/find',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${USERFRONT_READONLY_API_KEY}`,
        },
        body: JSON.stringify({
          order: 'lastActiveAt_ASC',
          page: 1,
        }),
      },
    )

    if (userfrontResp.status !== 200) {
      status = 500
      body.userfronAPIMessage = 'Userfront API is not responding'
    }

    res.status(status).json(body)
  })

  app.get('/oauth/notion', async (req, res) => {
    const { authToken } = req.query

    if (!authToken) {
      return res.redirect(
        createNotionAuthFailedRedirectURL({
          message:
            'error: unable to authenticate with notion. auth token not provided',
        }),
      )
    }

    const state = uuid()
    const params = new URLSearchParams({
      client_id: process.env.NOTION_CLIENT_ID,
      redirect_uri: NOTION_REDIRECT_URI,
      response_type: 'code',
      owner: 'user',
      state,
    })

    const reqUrl = new URL(`${NOTION_BASE_URL}/v1/oauth/authorize`)
    reqUrl.search = params.toString()

    res.cookie(AUTH_TOKEN_COOKIE_STATE_KEY, authToken, {
      httpOnly: !IS_LOCAL,
    })

    res.cookie(NOTION_AUTH_COOKIE_STATE_KEY, state, {
      httpOnly: !IS_LOCAL,
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

    if (error || prevState !== state) {
      return res.redirect(
        createNotionAuthFailedRedirectURL({
          message: 'access denied',
        }),
      )
    }

    try {
      const { userfrontID } = await verifyJWT(authToken)
      const userMeta = await getUserByUserfrontID(userfrontID)

      if (!userMeta) {
        return res.redirect(
          createNotionAuthFailedRedirectURL({
            message: 'could not authenticate',
          }),
        )
      }

      const tokenUrl = new URL(`${NOTION_BASE_URL}/v1/oauth/token`)

      let notionBasicAuth = `${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`
      notionBasicAuth = Buffer.from(notionBasicAuth).toString('base64')

      const tokenReqBody = {
        code,
        grant_type: 'authorization_code',
        redirect_uri: NOTION_REDIRECT_URI,
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
        return res.redirect(
          createNotionAuthFailedRedirectURL({
            message: 'unable to authenticate with notion',
          }),
        )
      }

      const { id } = await upsertNotionIntegration({
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

      await db.notionDatabases().where('notion_integration_id', id).delete()

      return res.redirect(`${FRONTEND_BASE_URL}/oauth/notion/success`)
    } catch (err) {
      console.error(err)
      return res.redirect(
        createNotionAuthFailedRedirectURL({
          message: 'failed to connect to notion',
        }),
      )
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
      success_url: `${FRONTEND_BASE_URL}/post-checkout`,
      cancel_url: `${FRONTEND_BASE_URL}/checkout-failed`,
      allow_promotion_codes: true,
    })

    return res.status(200).json({ sessionUrl: session.url })
  })

  app.post('/stripe/billing-portal', async (req, res) => {
    const { userfrontUserId } = req.body

    const subscription = await getSubscriptionByUserfrontUserId(userfrontUserId)

    if (!subscription) {
      return res.status(400).json({ message: 'user not found' })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${FRONTEND_BASE_URL}/account`,
    })

    return res.status(200).json({ sessionUrl: session.url })
  })

  app.get(
    '/files/attachments/:attachmentId/:filename',
    async (req: Request, res: Response) => {
      let { accessToken } = req.query
      const { attachmentId, filename } = req.params

      if (!accessToken) {
        return res.status(404).json({ message: 'not authorized' })
      }

      let user
      try {
        user = await verifyJWT(accessToken as string)
      } catch (err) {
        console.error(err)
      }

      console.log('user', user)
      console.log('attachmentId', attachmentId)

      if (!user) {
        return res.status(404).json({ message: 'not authorized' })
      }

      const attachment = await db
        .emailAttachments()
        .where(
          objectCamelToSnake({
            uuid: attachmentId,
            userfrontUserId: user.userfrontID,
          }),
        )
        .select(['filename'])
        .first()

      console.log('attachment', attachment)

      if (!attachment) {
        return res.status(404).json({ message: 'not authorized' })
      }

      // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/interfaces/getobjectcommandinput.html
      const file = await s3Client.send(
        new GetObjectCommand({
          Bucket: 'attachments',
          Key: `${attachmentId}-${attachment.filename}`,
        }),
      )

      // console.log(file)

      if (!file.Body) {
        return res.sendStatus(404)
      }

      res.setHeader('content-type', file.ContentType)
      // this will cause a browser to trigger a download
      // res.attachment(filename)

      // @ts-ignore
      // await streamFile(file.Body, res)
      file.Body.pipe(res)
    },
  )

  app.post('/inbound', upload.any(), emailReceiveHandler)
}

// http://localhost:3000/files/attachments/3778ac25-9974-4900-9343-c72f4848cf33/troll.png?authTokeeyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjdlM2Y3NWRjLTcyZjMtNGMwYy1hZjZlLWVhMDU1Zjg4NGJkZiJ9.eyJtb2RlIjoidGVzdCIsInRlbmFudElkIjoid245NXA2bjUiLCJ1c2VySWQiOjc1LCJ1c2VyVXVpZCI6IjFhNTljMjljLTkyMmEtNGJiOS1hMTQ2LWZiZGE1M2VhMTY5YiIsImlzQ29uZmlybWVkIjp0cnVlLCJhdXRob3JpemF0aW9uIjp7fSwiaXNzIjoidXNlcmZyb250Iiwic2Vzc2lvbklkIjoiYmFjN2E2MGUtZDE2Yy00ODJiLTlmODQtOWU1YmUxNzhkNzEzIiwiaWF0IjoxNjU4ODczNDYxLCJleHAiOjE2NTk0NzgyNjF9.BbW79pNawSyhMg0OP0f5vejncN7WPDLrwpwl_HR4X8u2HmeXN80IK2QEWjVSi_3NKlh9c6BXRbZjgDT7NSY1jNEdcsJC41e1JtQeJVUfxwLa7naT9j02boLFaH7EoT8ybrDOKoD2cIAo6mcFjxxZ0Vuf_NiU3lvRsiKn8bQXF7qDBPrDA-MNGSTCGlAoNSN-Tl57LZK4UeuDe-TtewZWRMcK4T1P26oTX9XR59z_DvqKu7RF3nlzSNpQomzEc-ECiZIWI5B8R8qrGFK8H0_Bd72NxlalqV31BepJ9c4blNsyMaARh6uuFtl8-YmnD6EhPBiyylEtHQorY73YSaED7vM3nP9Sv-UAt6KrVGbfSpRjPze_HHKZ960NzrSluGzwTq0URpgGdNXEXH-TqALHfPYxSwA4-CR0XzUnyssI_9JHWoqil7b8ZuNZjPG0aG-vLjm3lA-6ip2_meYmmONoXjGECS52WM0xXav9c95fEDH0dDVA4auAo4ltDE_vPH4hYYrXZ4gGSwyrVc7z72IlRLxndvNJetcvL3VndEz2E0afb_9rNy71FsG_dm6FpGz1aq3WShHx6p9KTgn0LHfdLEWAFXQZkZxONJhn-0NnQCBHauVz6HBtoL0mSK_QZbEFzLTBBkotx9NLFMTuzQ3cqwrQuIqPVw7GzbUg7WUZe3sn=

async function streamFile(fileStream: ReadableStream, res: Response) {
  return new Promise((resolve, reject) => {
    // @ts-ignore
    fileStream.once('error', (err) => {
      reject(err)
    })

    // @ts-ignore
    fileStream.on('data', (chunk) => {
      res.write(chunk)
    })

    // @ts-ignore
    fileStream.on('end', () => {
      res.end()
      resolve(null)
    })
  })
}

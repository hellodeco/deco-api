import express from 'express'
import type { Request, Response } from 'express'
import type { Express } from 'express'
import cookieParser from 'cookie-parser'
import dotenv from 'dotenv'
import fetch from 'node-fetch'
import multer from 'multer'
import { v4 as uuid } from 'uuid'
import bcrypt from 'bcrypt'
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
  S3_BUCKET,
} from './constants'
import { handleStripeWebhook } from './express-handlers/stripe-webhook'
import { emailReceiveHandler } from './express-handlers/sendgrid'
import { db } from './db-connection'
import { objectCamelToSnake } from './utils'
import s3Client from './s3/s3Client'
import { makeCorsMiddleware } from './cors-rules'
import type { NotionIntegration } from './types/database'

const TWENTY_FIVE_MB = 1048576 // 25mb

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
    limits: {
      fileSize: TWENTY_FIVE_MB,
    },
  }).any()

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

  app.use(makeCorsMiddleware())

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
        console.error('error authenticating with notion: ', tokenError)
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

  app.get('/stripe/checkout-session', async (req: Request<{}, any, any, { userfrontUserId: string; email: string>, res) => {
    const { userfrontUserId, email } = req.query

    const sessionPayload: Stripe.Checkout.SessionCreateParams = {
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${FRONTEND_BASE_URL}/email`,
      cancel_url: `${FRONTEND_BASE_URL}/checkout-failed`,
      allow_promotion_codes: true,
      metadata: { userfrontUserId: userfrontUserId },
    }

    const existingSub = await getSubscriptionByUserfrontUserId(userfrontUserId)

    if (existingSub) {
      sessionPayload.customer = existingSub.stripeCustomerId
    } else {
      sessionPayload.customer_email = email
    }

    const session = await stripe.checkout.sessions.create(sessionPayload)

    res.redirect(session.url)
  })

  app.get('/stripe/billing-portal', async (req: Request<{}, any, any, { userfrontUserId: string; }>, res) => {
    const { userfrontUserId } = req.query

    const subscription = await getSubscriptionByUserfrontUserId(userfrontUserId)

    if (!subscription) {
      return res.status(400).json({ message: 'user not found' })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${FRONTEND_BASE_URL}/account`,
    })

    res.redirect(session.url)
  })

  // TODO remove this after deploying corresponding frontend changes
  app.post('/stripe/checkout-session', async (req, res) => {
    const { userfrontUserId, email } = req.body

    const sessionPayload: Stripe.Checkout.SessionCreateParams = {
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${FRONTEND_BASE_URL}/email`,
      cancel_url: `${FRONTEND_BASE_URL}/checkout-failed`,
      allow_promotion_codes: true,
      metadata: { userfrontUserId: userfrontUserId },
    }

    const existingSub = await getSubscriptionByUserfrontUserId(userfrontUserId)

    if (existingSub) {
      sessionPayload.customer = existingSub.stripeCustomerId
    } else {
      sessionPayload.customer_email = email
    }

    const session = await stripe.checkout.sessions.create(sessionPayload)

    return res.status(200).json({ sessionUrl: session.url })
  })

  // TODO remove this after deploying corresponding frontend changes
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
    '/files/attachments/:attachmentUuid/:filename',
    async (req: Request, res: Response) => {
      /**
       * All attachement files require some form of authorization/token for downloading.
       * Available methods include:
       *
       * 1. the "st" query param which is a signing token that is generated by us at arbitrary times.
       * 2. the "authToken" query param which is a userfront issued JWT token for a given user.
       * 3. the "authorization" header in the form of "Authorization: Bearer <token>" which is a userfront issued JWT token for a given user.
       */
      let { authToken, st: signingToken } = req.query
      const { authorization } = req.headers
      const { attachmentUuid, filename } = req.params

      const streamFile = async ({
        objectKey,
        filename,
        mimetype,
      }: {
        objectKey: string
        filename: string
        mimetype: string
      }) => {
        // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/interfaces/getobjectcommandinput.html
        const file = await s3Client.send(
          new GetObjectCommand({
            Bucket: S3_BUCKET,
            Key: objectKey,
          }),
        )

        if (!file.Body) {
          return res.sendStatus(404).end()
        }

        res.setHeader('Content-Type', mimetype)
        // this should trigger a browser to show a preview if the browser supports it. Otherwise it will download the file.
        res.setHeader('Content-Disposition', `inline; filename=${filename}`)

        // @ts-ignore
        file.Body.on('end', () => {
          res.end()
        })
        // @ts-ignore
        return file.Body.pipe(res)
      }

      if (signingToken as string) {
        try {
          const attachment = await db
            .emailAttachments()
            .where('uuid', attachmentUuid)
            .select(['id', 'filename', 'mimetype'])
            .first()

          if (!attachment) {
            return res.status(404).end()
          }

          const tokenRows = await db
            .emailAttachmentTokens()
            .where('email_attachment_id', attachment.id)

            .select(['id', 'token'])

          let validTokenFound = false
          for (const { token } of tokenRows) {
            const isMatchingToken = await bcrypt.compare(signingToken, token)

            if (isMatchingToken) {
              validTokenFound = true
              break
            }
          }

          if (!validTokenFound) {
            return res.sendStatus(404).end()
          }

          // send file response and return
          return await streamFile({
            objectKey: `${attachmentUuid}-${attachment.filename}`,
            filename: attachment.filename,
            mimetype: attachment.mimetype,
          })
        } catch (err) {
          console.error(err)
          return res.sendStatus(500).end()
        }
      }

      if (!authToken && authorization) {
        authToken = authorization.split(' ')[1]
      }

      if (!authToken) {
        return res.status(404).end()
      }

      let user
      try {
        user = await verifyJWT(authToken as string)
      } catch (err) {
        console.error(err)
      }

      if (!user) {
        return res.status(404).end()
      }

      try {
        const attachment = await db
          .emailAttachments()
          .where(
            objectCamelToSnake({
              uuid: attachmentUuid,
              userfrontUserId: user.userfrontID,
            }),
          )
          .select(['filename', 'mimetype'])
          .first()

        if (!attachment) {
          return res.status(404).end()
        }

        return await streamFile({
          objectKey: `${attachmentUuid}-${attachment.filename}`,
          filename: attachment.filename,
          mimetype: attachment.mimetype,
        })
      } catch (err) {
        console.error(err)
        return res.sendStatus(500).end()
      }
    },
  )

  app.post(
    '/inbound',
    // custom upload middleware so that any errors are explicity passed along to Express and do not crash a server
    (req, res, next) => {
      upload(req, res, (err) => {
        if (err instanceof multer.MulterError) {
          console.log('MulterError encountered during file upload:', err)
        } else if (err) {
          console.log('Error encountered during file upload:', err)
        }

        next()
      })
    },
    emailReceiveHandler,
  )
}

import express, { Request, Response } from 'express'
import cookieParser from 'cookie-parser'
import bodyParser from 'body-parser'
import dotenv from 'dotenv'
import cors from 'cors'
import fetch from 'node-fetch'
import { v4 as uuid } from 'uuid'
import Stripe from 'stripe'
import {
  createNotionIntegration,
  getUserMetaByUserfrontID,
} from './../db-access/db-access'
import { verifyJWT } from './../jwt'
import {
  SERVER_BASE_URL,
  NOTION_BASE_URL,
  FRONTEND_BASE_URL,
} from './../constants'

dotenv.config()

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2020-08-27',
})

export const handleStripeWebhook = async (req: any, res: Response) => {
  const sig = req.headers['stripe-signature']
  let event
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    )
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  return res.status(200).end()
}

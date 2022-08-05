import { Request, Response } from 'express'
import dotenv from 'dotenv'
import Stripe from 'stripe'
import {
  getSubscriptionByStripeSubscriptionId,
  createOrUpdateSubscription,
  getUserByUserfrontID,
} from './../db-access/db-access'
import Userfront from '@userfront/core'
import { FRONTEND_DOMAIN, IS_LOCAL } from '../constants'

Userfront.init('wn95p6n5', {
  // Setting this tells the Userfront API to create login links, etc using the frontend domain
  domain: IS_LOCAL ? null : FRONTEND_DOMAIN,
})

dotenv.config()

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2020-08-27',
})

export async function handleStripeWebhook(req: Request, res: Response) {
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

  // todo - write handlers for cancelation events (after we launch)
  // will also want to split into separate handlers per event type and extract to their own files
  switch (event.type) {
    case 'checkout.session.completed': {
      try {
        const session = event.data.object

        const { userfrontUserId } = session.metadata

        const existingUser = await getUserByUserfrontID(userfrontUserId)

        if (existingUser) {
          await createOrUpdateSubscription({
            userfrontUserId: existingUser.userfrontUserId,
            stripeSubscriptionId: session.subscription,
          })
        }
      } catch (err) {
        console.log(err)
      }

      break
    }

    case 'customer.subscription.deleted':
    case 'customer.subscription.updated':
    case 'customer.subscription.created': {
      // TODO: we should also make sure that we dedupe any duplicate subscriptions for
      // a given userfrontUserId
      try {
        const subscription = event.data.object

        const dataToUpdate = {
          stripeCustomerId: subscription.customer,
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          currentPeriodStart: subscription.current_period_start,
          currentPeriodEnd: subscription.current_period_end,
          canceledAt: subscription.canceled_at,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          stripePriceId: subscription.plan.id,
          stripeProductId: subscription.plan.product,
        }

        const existingSub = getSubscriptionByStripeSubscriptionId(
          subscription.id,
        )

        if (existingSub) {
          createOrUpdateSubscription(dataToUpdate)
        }
      } catch (err) {
        console.log(err)
      }

      break
    }
  }

  return res.status(200).end()
}

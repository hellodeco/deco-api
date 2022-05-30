import express, { Request, Response } from 'express'
import dotenv from 'dotenv'
import fetch from 'node-fetch'
import Stripe from 'stripe'
import {
  createUser,
  createOrUpdateSubscription,
} from './../db-access/db-access'
import Userfront from '@userfront/core'
import { FRONTEND_BASE_URL } from '../constants'

Userfront.init('wn95p6n5')

dotenv.config()

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2020-08-27',
})

// even though we're only searching for ONE result
// we still have to have this garbage-ass giant object with all these conjunctions and groups
// real professional, Userfront
const generateUserfrontSearchPayload = (email: string) => ({
  order: 'lastActiveAt_ASC',
  page: 1,
  filters: {
    conjunction: 'and',
    filterGroups: [
      {
        conjunction: 'and',
        filters: [
          {
            attr: 'email',
            type: 'string',
            comparison: 'is',
            value: email,
          },
        ],
      },
    ],
  },
})

export const handleStripeWebhook = async (req: Request, res: Response) => {
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
  if (event.type === 'checkout.session.completed') {
    try {
      const session = event.data.object

      const { email, name } = session.customer_details

      // add userfront user
      // this will also automatically send a login link to the cx
      const signupResp = await Userfront.signup({
        method: 'passwordless',
        email: email,
        name: name,
        redirect: false,
      })

      if (process.env.NODE_ENV !== 'production') {
        const loginLink = `${FRONTEND_BASE_URL}/magic-link-login${signupResp?.result?.url}`
        console.log(
          `Hello mr. developer! 👋 Open the following link to continue testing login:\n\n\t\t${loginLink}\n\n`,
        )
      }

      // todo - swap out this Authorization header with a .env variable
      // get userfront UUID from signup
      const userfrontResponse = await fetch(
        'https://api.userfront.com/v0/users/find',
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization:
              'Bearer uf_test_admin_wn95p6n5_35cde8ca99b2438107c4e77ab0fa8356',
          },
          body: JSON.stringify(generateUserfrontSearchPayload(email)),
        },
      )

      const userfrontData = await userfrontResponse.json()
      const createdUserUUID = userfrontData?.results?.[0]?.userUuid

      // todo: We should handle this case better
      // sometimes this is undefined and then crashes the server because our subscription table does not accept a null
      // value for userfront_user_id.
      if (!createdUserUUID) {
        res.status(500).end()
      }

      /**
       * This must happen before creating the subscription in the database or else Postgres will error
       * and complain about a foreign key for the user not existing in the database
       */
      await createUser({
        userfrontUserId: createdUserUUID,
        fullName: name,
        signupEmail: email,
      }),

      await createOrUpdateSubscription({
        userfrontUserId: createdUserUUID,
        stripeSubscriptionId: session.subscription,
      }),
    } catch (err) {
      console.log(err)
    }
  }

  if (event.type === 'customer.subscription.updated') {
    try {
      const subscription = event.data.object

      /**
       * @todo this breaks on update if the sub has not been created yet because userfront uuid is not present and that is a non-null field
       */
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

      createOrUpdateSubscription(dataToUpdate)
    } catch (err) {
      console.log(err)
    }
  }

  return res.status(200).end()
}

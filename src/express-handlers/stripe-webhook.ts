import { Request, Response } from 'express'
import dotenv from 'dotenv'
import fetch from 'node-fetch'
import Stripe from 'stripe'
import {
  createUser,
  createOrUpdateSubscription,
  getUserBySignupEmail,
} from './../db-access/db-access'
import Userfront from '@userfront/core'
import {
  FRONTEND_DOMAIN,
  FRONTEND_BASE_URL,
  IS_LOCAL,
  USERFRONT_READONLY_API_KEY,
} from '../constants'

Userfront.init('wn95p6n5', {
  // Setting this tells the Userfront API to create login links, etc using the frontend domain
  domain: IS_LOCAL ? null : FRONTEND_DOMAIN,
})

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

        const { email, name } = session.customer_details

        const existingUser = await getUserBySignupEmail(email)

        if (!existingUser) {
          // add userfront user
          // this will also automatically send a login link to the cx
          const signupResp = await Userfront.signup({
            method: 'passwordless',
            email: email,
            name: name,
            redirect: false,
          })

          if (IS_LOCAL) {
            const loginLink = `${FRONTEND_BASE_URL}${signupResp?.result?.url}`
            console.log(
              `Hello mr. developer! 👋 Open the following link to continue testing login:\n\n\t\t${loginLink}\n\n`,
            )
          }
        }

        // get userfront UUID from signup
        const userfrontResponse = await fetch(
          'https://api.userfront.com/v0/users/find',
          {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              Authorization: `Bearer ${USERFRONT_READONLY_API_KEY}`,
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
          return res
            .status(500)
            .json({
              userfrontResponseStatusCode: userfrontResponse.status,
              message: `no userfront user found for ${email}`,
            })
            .end()
        }

        if (!existingUser) {
          await createUser({
            userfrontUserId: createdUserUUID,
            fullName: name,
            signupEmail: email,
          })
        }

        await createOrUpdateSubscription({
          userfrontUserId: createdUserUUID,
          stripeSubscriptionId: session.subscription,
        })
      } catch (err) {
        console.log(err)
      }

      break
    }

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

        createOrUpdateSubscription(dataToUpdate)
      } catch (err) {
        console.log(err)
      }

      break
    }
  }

  return res.status(200).end()
}

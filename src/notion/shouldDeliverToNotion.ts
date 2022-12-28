import { db } from '../db-connection'
import { FREE_TIER_EMAIL_LIMIT } from '../constants'
import { getNotionClient } from './getNotionClient'
import type {
  Subscription,
  NotionDatabase,
  NotionIntegration,
} from '../types/database'

export async function shouldDeliverToNotion(userfrontUserId: string) {
  let subscription: Subscription
  try {
    // multiple subscriptions can sometimes exist for one user so we need
    // to check all of them here
    subscription = await db
      .subscriptions()
      .where({
        userfront_user_id: userfrontUserId,
        subscription_status: 'active',
      })
      .select('subscription_status')
      .first()
  } catch (err) {
    console.error('error querying for subscription', err)
  }

  // We will deliver email to notion under the following conditions:
  // 1. user has a subscription with a status of "active"
  // 2. user has no subscription OR active subscription AND has a notion_integration AND notion_database AND less than FREE_TIER_EMAIL_LIMIT emails in their connection Notion database
  let shouldDelieverToNotion = Boolean(subscription)

  let notionIntegration: Pick<NotionIntegration, 'id' | 'accessToken'>
  if (!subscription) {
    try {
      notionIntegration = await db
        .notionIntegrations()
        .where('userfront_user_id', userfrontUserId)
        .select('id', 'access_token')
        .first()
    } catch (err) {
      console.error(err)
    }
  }

  let notionDatabase: Pick<NotionDatabase, 'notionDatabaseId'>
  if (!subscription && notionIntegration) {
    try {
      notionDatabase = await db
        .notionDatabases()
        .where('notion_integration_id', notionIntegration.id)
        .select('notion_database_id')
        .first()
    } catch (err) {
      console.error(err)
    }
  }

  if (!subscription && notionDatabase) {
    const { notionDatabaseId } = notionDatabase

    // this is a fast and messy way to get the count of rows in the notion database inbox
    const notion = await getNotionClient(userfrontUserId)

    // this is an array of objects where each object represents a row in the email inbox database
    const { results: notionRowData } = await notion.databases.query({
      database_id: notionDatabaseId,
      // limit to one greater than the email limit so to avoid overfetching
      page_size: FREE_TIER_EMAIL_LIMIT + 1,
    })

    shouldDelieverToNotion = notionRowData.length < FREE_TIER_EMAIL_LIMIT
  }

  return shouldDelieverToNotion
}

import dbConnection from '../db-connection'
import { objectCamelToSnake } from '../utils'
import { EmailStatus } from '../constants'
import { Header } from '../express-handlers/sendgrid'
import { Tables } from '../types/database'
import type {
  User,
  NotionDatabase,
  Subscription,
  NotionIntegration,
} from '../types/database'

//  CREATE FUNCTIONS =================================================

export async function createOrUpdateSubscription(subscription: Subscription) {
  const existingSub = await dbConnection<Subscription>(Tables.SUBSCRIPTIONS)
    .where('stripe_subscription_id', subscription.stripeSubscriptionId)
    .select('*')
    .first()

  if (existingSub) {
    return dbConnection<Subscription>(Tables.SUBSCRIPTIONS)
      .where('stripe_subscription_id', subscription.stripeSubscriptionId)
      .update(objectCamelToSnake(subscription))
  }

  // userfront_user_id is a non-null field so we can't store anything if this doesn't exist
  if (!subscription.userfrontUserId) {
    return null
  }

  return dbConnection<Subscription>(Tables.SUBSCRIPTIONS).insert(
    objectCamelToSnake(subscription),
  )
}

export function createUser(userMeta: User) {
  return dbConnection<User>('users').insert(objectCamelToSnake(userMeta))
}

export async function createOrUpdateNotionDatabase(
  notionDatabase: NotionDatabase,
) {
  const existingDatabase = await dbConnection<NotionDatabase>(
    'notion_databases',
  )
    .where('notion_database_id', notionDatabase.notionDatabaseId)
    .select('*')
    .first()

  if (existingDatabase) {
    return dbConnection<NotionDatabase>('notion_databases')
      .where('notion_integration_id', notionDatabase.notionIntegrationId)
      .update(objectCamelToSnake(notionDatabase))
  }

  return dbConnection<NotionDatabase>('notion_databases').insert(
    objectCamelToSnake(notionDatabase),
  )
}

export async function createNewEmailHeadersByEmailId(
  emailHeaders: Array<Header>,
) {
  return await dbConnection('email_headers').insert(
    emailHeaders.map((header) => objectCamelToSnake(header)),
  )
}

//  GET FUNCTIONS =================================================

export function getAllThreadsByUserMetaID(userMetaID: string) {
  return dbConnection('email_threads').where('user_id', userMetaID)
}

export function getAllEmailsByThreadID(threadID: string) {
  return dbConnection('emails').where('email_thread_id', threadID)
}

export function getEmailByMessageID(messageID: string) {
  return dbConnection('emails')
    .where('message_id', messageID)
    .select('*')
    .first()
}

export function getEmailThreadByID(threadID: string) {
  return dbConnection('email_threads').where('id', threadID).select('*').first()
}

export function getEmailThreadBySubject(subject: string) {
  return dbConnection('email_threads')
    .where('subject', subject)
    .select('*')
    .first()
}

export function getUserByUserfrontID(userfrontID: string) {
  return dbConnection<User>('users')
    .where('userfront_user_id', userfrontID)
    .select('*')
    .first()
}

export function getUserByDecoEmail(decoEmail: string) {
  return dbConnection<User>('users')
    .where('email_address', decoEmail)
    .select('*')
    .first()
}

export function getUserBySignupEmail(signupEmail: string) {
  return dbConnection<User>('users')
    .where('signup_email', signupEmail)
    .select('*')
    .first()
}

export function getNotionIntegrationByUserfrontID(userfrontID: string) {
  return dbConnection<NotionIntegration>('notion_integrations')
    .where('userfront_user_id', userfrontID)
    .select('*')
    .first()
}

export async function getNotionDatabaseIDByUsefrontID(userfrontID: string) {
  const notionIntegration = await dbConnection<NotionIntegration>(
    'notion_integrations',
  )
    .where('userfront_user_id', userfrontID)
    .select('id')
    .first()

  return dbConnection<NotionDatabase>('notion_databases')
    .where('notion_integration_id', notionIntegration.id)
    .select('*')
    .first()
}

export async function getSubscriptionByUserfrontUserId(userfrontID: string) {
  return dbConnection<Subscription>(Tables.SUBSCRIPTIONS)
    .where('userfront_user_id', userfrontID)
    .select('*')
    .first()
}

//  UPDATE FUNCTIONS =================================================

export function updateUsersDecoEmailAddress(
  userfrontID: string,
  emailAddress: string,
) {
  return dbConnection('users')
    .where('userfront_user_id', userfrontID)
    .update({ email_address: emailAddress })
}

export async function updateDeliveredEmailStatus(
  emailId: number,
  status: EmailStatus,
) {
  return dbConnection('emails').where('id', emailId).update({ status: status })
}

export async function updateDeliveredEmailNotionPage(
  emailId: number,
  notionPageId: string,
) {
  return dbConnection('emails')
    .where('id', emailId)
    .update({ notion_page_id: notionPageId })
}

import dbConnection from '../db-connection'
import { objectCamelToSnake } from '../utils'
import { EmailStatus } from '../constants'
import { Header } from '../express-handlers/sendgrid'


/**
 * @todo type these return values
 */

interface DBModel {
  createdAt: string
  updatedAt: string
}

interface User {
  id?: string
  userfrontUserId: string
  fullName: string
  signupEmail?: string
  emailAddress?: string
  stripeCustomerId?: string
}

interface DecoDBEmail {
  id: number
  subject: string
  plainTextContent: string
  from: string
  emailThreadId?: number
  htmlContent?: string
  status?: string
  notionPageId?: string
  messageId?: string
  inReplyTo?: string
  references?: string
}

interface NotionDatabase {
  notionDatabaseId: string
  notionIntegrationId: number
}

interface Subscription {
  id?: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  subscriptionStatus?: string
  currentPeriodStart?: number
  currentPeriodEnd?: number
  canceledAt?: number
  cancelAtPeriodEnd?: boolean
  stripePriceId?: string
  stripeProductId?: string
  userfrontUserId?: number
}

export interface NotionIntegration {
  id?: number
  userfrontUserId: string
  accessToken: string
  tokenType: string
  workspaceId: string
  workspaceName: string
  workspaceIcon: string
  botId: string
  userId: string
  userFullName: string
  avatarURL: string
  type: string
  email: string
}

interface EmailThread {
  id?: number
  subject?: string
  user_id?: string
}

type EmailThreadArray = EmailThread[]

enum Tables {
  NOTION_INTEGRATIONS = 'notion_integrations',
  SUBSCRIPTIONS = 'subscriptions',
}

//  CREATE FUNCTIONS =================================================

export async function createNewEmailThreadByUserID(
  subject: string,
  userMetaId: string,
): Promise<EmailThreadArray> {
  return await dbConnection('email_threads').returning('*').insert({
    subject: subject,
    user_id: userMetaId,
  })
}

export async function createNewEmail(emailData: {
  userId?: string
  subject: string
  from: string
  status?: string
  emailThreadId?: number
  plainTextContent: string
  htmlContent?: string
  messageId?: string
  inReplyTo?: string
  references?: string
}): Promise<DecoDBEmail[]> {
  return dbConnection('emails')
    .returning('*')
    .insert(objectCamelToSnake(emailData))
}

export async function createOrUpdateNotionIntegration(
  notionIntegration: NotionIntegration,
) {
  const integration = await dbConnection<NotionIntegration>(
    Tables.NOTION_INTEGRATIONS,
  )
    .where('userfront_user_id', notionIntegration.userfrontUserId)
    .select('id')
    .first()

  if (integration) {
    return dbConnection<NotionIntegration>(Tables.NOTION_INTEGRATIONS)
      .where('userfront_user_id', notionIntegration.userfrontUserId)
      .update(objectCamelToSnake(notionIntegration))
      .returning('*')
      .first()
  }

  const [newIntegration] = await dbConnection<NotionIntegration>(Tables.NOTION_INTEGRATIONS)
    .insert(objectCamelToSnake(notionIntegration))
    .returning('*')

  return newIntegration
}

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

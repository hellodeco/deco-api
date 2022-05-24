import dbConnection from '../db-connection'
import { objectCamelToSnake } from '../utils'

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

interface NotionIntegration {
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

enum Tables {
  NOTION_INTEGRATIONS = 'notion_integrations',
  SUBSCRIPTIONS = 'subscriptions',
}

//  CREATE FUNCTIONS =================================================

export async function createNewEmailThreadByUserID(
  subject: string,
  userMetaId: string,
): Promise<EmailThread> {
  return await dbConnection('email_threads').returning('*').insert({
    subject: subject,
    user_id: userMetaId,
  })
}

export async function createNewEmailByUserID(args: {
  userId: string
  emailThreadId?: number
  plainTextContent: string
  htmlContent?: string
  messageID?: string
  inReplyTo?: string
  references?: string
}) {
  const thread = await dbConnection('email_threads').where(
    'id',
    args.emailThreadId,
  )

  const user = await dbConnection('users').where('id', args.userId)

  return dbConnection('emails').insert({
    subject: thread[0].subject,
    plain_text_content: args.plainTextContent,
    html_content: args.htmlContent,
    from: user[0].emailAddress,
    status: 'DRAFT',
    user_id: args.userId,
    message_id: args.messageID,
    in_reply_to: args.inReplyTo,
    references: args.references,
    email_thread_id: args.emailThreadId,
  })
}

export async function createOrUpdateNotionIntegration(
  notionIntegration: NotionIntegration,
) {
  const integration = await dbConnection<NotionIntegration>(
    Tables.NOTION_INTEGRATIONS,
  )
    .where('userfront_user_id', notionIntegration.userfrontUserId)
    .select('*')
    .first()

  if (integration) {
    return dbConnection<NotionIntegration>(Tables.NOTION_INTEGRATIONS)
      .where('userfront_user_id', notionIntegration.userfrontUserId)
      .update(objectCamelToSnake(notionIntegration))
  }

  return dbConnection<NotionIntegration>(Tables.NOTION_INTEGRATIONS).insert(
    objectCamelToSnake(notionIntegration),
  )
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

export function getUserMetaByUserfrontID(userfrontID: string) {
  return dbConnection<User>('users')
    .where('userfront_user_id', userfrontID)
    .select('*')
    .first()
}

export function getUserMetaByDecoEmail(decoEmail: string) {
  return dbConnection<User>('users')
    .where('email_address', decoEmail)
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
    .select('*')
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

export function updateDecoEmail(userfrontID: string, emailAddress: string) {
  return dbConnection<User>('users')
    .where('userfront_user_id', userfrontID)
    .update(objectCamelToSnake({ email_address: emailAddress }))
}

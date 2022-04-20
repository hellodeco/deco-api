import dbConnection from '../db-connection'
import { objectCamelToSnake } from '../utils'

/**
 * @todo type these return values
 */

interface DBModel {
  createdAt: string
  updatedAt: string
}

interface UserMeta extends DBModel {
  userfrontUserId: string
  fullName: string
  signupEmail?: string
  emailAddress?: string
}

interface NotionIntegration {
  userfrontUserID: string
  accessToken: string
  tokenType: string
  workspaceID: string
  workspaceName: string
  workspaceIcon: string
  botID: string
  userID: string
  userFullName: string
  avatarURL: string
  type: string
  email: string
}

export function getAllEmails() {
  return dbConnection('emails').select('*')
}

export function getAllThreadsByUserMetaID(userMetaID: string) {
  return dbConnection('email_threads').where('user_meta_id', userMetaID)
}

export function getAllEmailsByThreadID(threadID: string) {
  return dbConnection('emails').where('email_thread_id', threadID)
}

export function createNewThreadByUserMetaID(
  subject: string,
  userMetaID: string,
) {
  const date = new Date().toISOString()
  return dbConnection('email_threads').insert({
    created_at: date,
    updated_at: date,
    subject: subject,
    user_meta_id: userMetaID,
  })
}

export async function createNewEmailByUserMetaID(args: {
  plainTextContent: string
  htmlContent?: string
  userMetaID: string
  messageID?: string
  inReplyTo?: string
  references?: string
  emailThreadID: string
}) {
  const thread = await dbConnection('email_threads').where(
    'id',
    args.emailThreadID,
  )

  const user = await dbConnection('user_meta').where('id', args.userMetaID)

  const date = new Date().toISOString()
  return dbConnection('emails').insert({
    created_at: date,
    updated_at: date,
    subject: thread[0].subject,
    plain_text_content: args.plainTextContent,
    html_content: args.htmlContent,
    from: user[0].emailAddress,
    status: 'DRAFT',
    user_meta_id: args.userMetaID,
    message_id: args.messageID,
    in_reply_to: args.inReplyTo,
    references: args.references,
    email_thread_id: args.emailThreadID,
  })
}

export function getUserMetaByUserfrontID(userfrontID: string) {
  return dbConnection<UserMeta>('user_meta')
    .where('userfront_user_id', userfrontID)
    .select('*')
    .first()
}

export function createNotionIntegration(notionIntegration: NotionIntegration) {
  return dbConnection<NotionIntegration>('notion_integrations').insert(
    objectCamelToSnake(notionIntegration),
  )
}

export function createUserMeta(userMeta: UserMeta) {
  return dbConnection<UserMeta>('user_meta').insert(
    objectCamelToSnake(userMeta),
  )
}

export function checkEmailAddressAvailability(decoEmail: string) {
  return dbConnection<UserMeta>('user_meta')
    .where('email_address', decoEmail)
    .select('*')
    .first()
}

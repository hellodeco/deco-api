import knex from 'knex'
import knexConfig from './knexfile'
import {
  Tables,
  User,
  DecoDBEmail,
  NotionIntegration,
  NotionDatabase,
  Subscription,
  EmailHeader,
  EmailThread,
  EmailAttachment,
  EmailAttachmentTokens,
} from './types/database'

const dbConnection = knex(knexConfig)

export default dbConnection

export const db = {
  users: () => dbConnection<User>(Tables.USERS),
  emails: () => dbConnection<DecoDBEmail>(Tables.EMAILS),
  subscriptions: () => dbConnection<Subscription>(Tables.SUBSCRIPTIONS),
  notionIntegrations: () =>
    dbConnection<NotionIntegration>(Tables.NOTION_INTEGRATIONS),
  notionDatabases: () => dbConnection<NotionDatabase>(Tables.NOTION_DATABASES),
  emailHeaders: () => dbConnection<EmailHeader>(Tables.EMAIL_HEADERS),
  emailThreads: () => dbConnection<EmailThread>(Tables.EMAIL_THREADS),
  emailAttachments: () =>
    dbConnection<EmailAttachment>(Tables.EMAIL_ATTACHMENTS),
  emailAttachmentTokens: () => dbConnection<EmailAttachmentTokens>(Tables.EMAIL_ATTACHMENT_TOKENS),
}

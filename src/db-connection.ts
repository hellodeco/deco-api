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
} from './types/database'

const dbConnection = knex(knexConfig)

export default dbConnection

export const db = {
  users: () => dbConnection<User>(Tables.USERS),
  emails: () => dbConnection<DecoDBEmail>(Tables.EMAILS),
  subscriptions: () => dbConnection<Subscription>(Tables.SUBSCRIPTIONS),
  notionIntegrations: () => dbConnection<NotionIntegration>(Tables.NOTION_INTEGRATIONS),
  notionDatabases: () => dbConnection<NotionDatabase>(Tables.NOTION_DATABASES),
  emailHeaders: () => dbConnection<EmailHeader>(Tables.EMAIL_HEADERS),
}

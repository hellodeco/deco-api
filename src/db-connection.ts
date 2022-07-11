import knex from 'knex'
import knexConfig from './knexfile'
import {
  Tables,
  User,
  NotionIntegration,
  NotionDatabase,
  Subscription,
} from './types/database'

const dbConnection = knex(knexConfig)

export default dbConnection

export const db = {
  users: () => dbConnection<User>(Tables.USERS),
  subscriptions: () => dbConnection<Subscription>(Tables.SUBSCRIPTIONS),
  notionIntegrations: () => dbConnection<NotionIntegration>(Tables.NOTION_INTEGRATIONS),
  notionDatabases: () => dbConnection<NotionDatabase>(Tables.NOTION_DATABASES),
}

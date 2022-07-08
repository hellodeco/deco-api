import knex from 'knex'
import knexConfig from './knexfile'
import {
  Tables,
  User,
  Subscription,
} from './types/database'

const dbConnection = knex(knexConfig)

export default dbConnection

export const db = {
  users: () => dbConnection<User>(Tables.USERS),
  subscriptions: () => dbConnection<Subscription>(Tables.SUBSCRIPTIONS),
}


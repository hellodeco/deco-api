import * as dbAccess from '../db-access/db-access'
import * as notionAccess from '../notion/notion'

export interface User {
  userfrontID: string
}

export interface ApolloServerContext {
  dbAccess: typeof dbAccess
  user: User
  notionAccess: typeof notionAccess
}

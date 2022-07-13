import type { User } from '../resolvers/resolvers'
import * as dbAccess from '../db-access/db-access'
import * as notionAccess from '../notion/notion'
import { db } from '../db-connection'

export interface ResolverContext {
  user: User
  db: typeof db
  dbAccess: typeof dbAccess
  notionAccess: typeof notionAccess
}


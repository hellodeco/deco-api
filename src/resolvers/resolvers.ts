import { GraphQLUUID } from 'graphql-scalars'
import { Resolvers } from '../generated/resolvers-types'
import * as dbAccess from '../db-access'
import { queryResolvers } from './queries'
import { mutationResolvers } from './mutations'

interface Context {
  dbAccess: typeof dbAccess
  user: User
}

export interface User {
  userfrontID: string
}

const resolvers: Resolvers<Context> = {
  UUID: GraphQLUUID,
  Query: queryResolvers,
  // Mutation: mutationResolvers,
}

export default resolvers

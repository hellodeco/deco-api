import { GraphQLUUID } from 'graphql-scalars'
import { Resolvers } from './generated/resolvers-types'
import * as dbAccess from './db-access'

interface Context {
  dbAccess: typeof dbAccess
  user: User
}

export interface User {
  userfrontID: string
}

const resolvers: Resolvers<Context> = {
  UUID: GraphQLUUID,
  Query: {
    allEmails: (parent, args, context) => context.dbAccess.getAllEmails(),
    currentUser: async (parrent, args, { dbAccess, user }) => {
      const userMeta = await dbAccess.getUserMetaByUserfrontID(user.userfrontID) 
      return {
        fullName: userMeta.full_name,
        emailAddress: userMeta.email_address,
        userfrontID: user.userfrontID,
      }
    },
  },
}

export default resolvers

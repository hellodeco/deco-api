import { QueryResolvers } from '../generated/resolvers-types'

export const queryResolvers: QueryResolvers = {
  allEmails: (parent, args, context) => context.dbAccess.getAllEmails(),
  currentUser: async (parrent, args, { dbAccess, user }) => {
    const userMeta = await dbAccess.getUserMetaByUserfrontID(user.userfrontID) 
    return {
      fullName: userMeta.fullName,
      emailAddress: userMeta.emailAddress,
      userfrontID: user.userfrontID,
    }
  }
}

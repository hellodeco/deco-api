import { QueryResolvers } from '../generated/resolvers-types'

export const queryResolvers: QueryResolvers = {
  getUserMetaByDecoEmail: async (parent, args, context) => {
    const existingUser = await context.dbAccess.getUserMetaByDecoEmail(
      args.decoEmail,
    )

    if (existingUser) {
      return true
    }

    return false
  },
  currentUser: async (parent, args, { dbAccess, user }) => {
    const userMeta = await dbAccess.getUserMetaByUserfrontID(user.userfrontID)
    return {
      fullName: userMeta.fullName,
      emailAddress: userMeta.emailAddress,
      signupEmail: userMeta.signupEmail,
      userfrontID: user.userfrontID,
    }
  },
  emailAddressAvailable: async (parent, args, { dbAccess }) => {
    const userMeta = await dbAccess.getUserMetaByDecoEmail(args.email)
    return userMeta ? false : true
  },
}

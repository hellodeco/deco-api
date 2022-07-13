import { QueryResolvers } from '../generated/resolvers-types'
import { EMAIL_DOMAIN } from '../constants'
import { reservedUsernames } from '../reservedUsernames'
import { ResolverContext } from '../types/shared'

export const queryResolvers: QueryResolvers<ResolverContext> = {
  currentUser: async (parent, args, { dbAccess, user }) => {
    const userMeta = await dbAccess.getUserByUserfrontID(user.userfrontID)
    return {
      fullName: userMeta.fullName,
      emailAddress: userMeta.emailAddress,
      signupEmail: userMeta.signupEmail,
      userfrontID: user.userfrontID,
    }
  },
  emailUsernameAvailable: async (parent, { username }, { dbAccess }) => {
    if (reservedUsernames.has(username)) {
      return false
    }

    const email = `${username}@${EMAIL_DOMAIN}`
    const userMeta = await dbAccess.getUserByDecoEmail(email)

    return userMeta ? false : true
  },
  getCurrentUserNotionDatabaseInfo: async (
    parent,
    args,
    { notionAccess, user, db },
  ) => {
    try {
      return await notionAccess.getCurrentUserNotionDatabaseInfo(
        user.userfrontID,
      )
    } catch (err) {
      console.error(err)
      return null
    }
  },
  emailDomain: async () => {
    console.log(EMAIL_DOMAIN)
    return EMAIL_DOMAIN
  },
}

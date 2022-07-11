import { QueryResolvers } from '../generated/resolvers-types'
import { EMAIL_DOMAIN } from '../constants'
import { reservedUsernames } from '../reservedUsernames'

export const queryResolvers: QueryResolvers = {
  /**
   * @todo remove this if we do not use it!
   */
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
  getCurrentUserNotionIntegration: async (parent, args, { dbAccess, user }) => {
    // omit the access token since it is a sensitive value and not needed for front end code
    const { accessToken, ...integration } =
      await dbAccess.getNotionIntegrationByUserfrontID(user.userfrontID)

    if (!accessToken) {
      return null
    }

    return integration
  },
  getCurrentUserNotionDatabaseInfo: async (
    parent,
    args,
    { notionAccess, user },
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

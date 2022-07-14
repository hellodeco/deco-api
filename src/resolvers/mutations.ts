import { EMAIL_DOMAIN } from '../constants'
import {
  MutationResolvers,
  UpdateDecoEmailErrorReasons,
} from '../generated/resolvers-types'
import { reservedUsernames } from '../reservedUsernames'
import { ResolverContext } from '../types/shared'

export const mutationResolvers: MutationResolvers<ResolverContext> = {
  wipeNotionDatabase: async (_, args, { notionAccess, user }) => {
    const archivedIDs = await notionAccess.wipeNotionDatabase(user.userfrontID)
    return archivedIDs
  },
  deleteNotionTableProperties: async (_, args, { notionAccess, user }) => {
    const deletedProperties = await notionAccess.deleteNotionTableProperties(
      user.userfrontID,
    )
    return deletedProperties
  },
  formatNotionTable: async (_, args, { notionAccess, user }) => {
    const formattedTable = await notionAccess.formatNotionTable(
      user.userfrontID,
    )
    return formattedTable
  },
  // formatNotionDatabase: async (_, args, { notionAccess, user }) => {
  //
  // },
  setDecoEmail: async (
    _,
    { username: unNormalizedUsername },
    { dbAccess, db, user: { userfrontID } },
  ) => {
    const user = await dbAccess.getUserByUserfrontID(userfrontID)
    const username = unNormalizedUsername.toLowerCase()
    if (user?.emailAddress) {
      return {
        success: false,
        errorReason: UpdateDecoEmailErrorReasons.CannotChangeEmail,
      }
    }

    const emailAddress = `${username}@${EMAIL_DOMAIN}`

    const existingUser = await dbAccess.getUserByDecoEmail(emailAddress)

    if (reservedUsernames.has(username) || existingUser) {
      return {
        success: false,
        errorReason: UpdateDecoEmailErrorReasons.AlreadyTaken,
      }
    }

    const subscription = await db
      .subscriptions()
      .where({
        userfront_user_id: userfrontID,
        subscription_status: 'active',
      })
      .select('*')
      .first()

    if (!subscription || subscription?.subscriptionStatus !== 'active') {
      return {
        success: false,
        errorReason: UpdateDecoEmailErrorReasons.NoSubscription,
      }
    }

    if (username.length < 3) {
      return {
        success: false,
        errorReason: UpdateDecoEmailErrorReasons.NotEnoughChars,
      }
    }

    /**
     * @reference for valid email username format: https://stackoverflow.com/a/2049510
     */
    const validEmailUsername = /^\w+([\.-]?\w+)*$/

    if (!validEmailUsername.test(username)) {
      return {
        success: false,
        errorReason: UpdateDecoEmailErrorReasons.InvalidFormat,
      }
    }

    await dbAccess.updateUsersDecoEmailAddress(userfrontID, emailAddress)

    return {
      success: true,
      errorReason: null,
    }
  },
}

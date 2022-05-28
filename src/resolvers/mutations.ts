import { EMAIL_DOMAIN } from '../constants'
import { MutationResolvers, UpdateDecoEmailErrorReasons } from '../generated/resolvers-types'

export const mutationResolvers: MutationResolvers = {
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
  addEmailToNotion: async (
    _,
    { toAddress, newEmail },
    { notionAccess, dbAccess },
  ) => {
    const userMeta = dbAccess.getUserMetaByDecoEmail(toAddress)

    if (!userMeta) {
      return {
        success: false,
      }
    }

    await notionAccess.addEmailToNotion({
      newEmail,
      userfrontID: userMeta.userfrontID,
    })

    return {
      success: true,
    }
  },
  setDecoEmail: async (_, { username }, { dbAccess, user: { userfrontID } }) => {
    const user = await dbAccess.getUserMetaByUserfrontID(userfrontID)

    if (user.emailAddress) {
      return {
        success: false,
        errorReason: UpdateDecoEmailErrorReasons.CannotChangeEmail,
      }
    }

    const emailAddress = `${username}@${EMAIL_DOMAIN}`

    const existingUser = await dbAccess.getUserMetaByDecoEmail(emailAddress)

    if (existingUser) {
      return {
        success: false,
        errorReason: UpdateDecoEmailErrorReasons.AlreadyTaken,
      }
    }

    const subscription = await dbAccess.getSubscriptionByUserfrontUserId(userfrontID)


    if (!subscription || subscription.subscriptionStatus !== 'active') {
      return {
        success: false,
        errorReason: UpdateDecoEmailErrorReasons.NoSubscription,
      }
    }

    /**
     * @reference for valid email username format: https://stackoverflow.com/a/2049510
     */
    const validEmailUsername = /^\w+([\.-]?\w+)*$/

    if (!validEmailUsername.test(username)) {
      return {
        success: false,
        errorReason: UpdateDecoEmailErrorReasons.InvalidFormat
      }
    }

    await dbAccess.updateDecoEmail(
      userfrontID,
      emailAddress,
    )

    return {
      success: true,
      errorReason: null,
    }
  },
}

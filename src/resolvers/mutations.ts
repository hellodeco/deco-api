import { EMAIL_DOMAIN } from '../constants'
import {
  MutationResolvers,
  UpdateDecoEmailErrorReasons,
} from '../generated/resolvers-types'
import { reservedUsernames } from '../reservedUsernames'
import { ResolverContext } from '../types/shared'


/**
 * Notion formatting setup order of operations:
 * 
 * 1. connect Notion database(s)
 * 2. if multiple selected ask user to select which one to use
 * 3. detect if single selected page is correct format (full page database)
 * 4. if it isn't ask user to format it correctly and provide instructions (video + written instructions)
 * 5. once it is correct type, ask user to "format". This kicks off the following sequential steps under the hood:
 *     a. wipeNotionDatabase (delete all existing data)
 *     b. deleteNotionTableProperties (delete all existing table properties)
 *     c. formatNotionTable (add table properties)
 * 
 * Required code changes for this:
 * 
 * 1. Notion callback route will no longer query Notion for databases
 *    a. it won't check that the page is formatted correctly
 *    b. it won't auto choose the first shared page in the notion provided list
 * 2. New API / API functionality to report if multiple pages are shared
 * 3. New API to choose one page to use
 */

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

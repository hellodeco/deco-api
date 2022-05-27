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
  updateDecoEmail: async (_, { emailHandle }, { dbAccess, user: { userfrontID } }) => {
    const user = dbAccess.getUserMetaByUserfrontID(userfrontID)

    // We do not allow users to change their email after setting it
    if (user.decoEmail) {
      return {
        success: false,
        errorReason: UpdateDecoEmailErrorReasons.CannotChangeEmail,
      }
    }

    const emailAddress = `${emailHandle}@deco.co`

    const existingUser = await dbAccess.getUserMetaByDecoEmail(emailAddress)

    if (existingUser) {
      return {
        success: false,
        errorReason: UpdateDecoEmailErrorReasons.AlreadyTaken,
      }
    }

    /**
     * @todo do character validation in emailHandle
     * Useful reference: https://stackoverflow.com/a/2049510
     */
    let invalidChars = false

    if (invalidChars) {
      return {
        success: false,
        errorReason: UpdateDecoEmailErrorReasons.InvalidCharacters,
      }
    }

    await dbAccess.updateDecoEmail(
      userfrontID,
      emailAddress,
    )

    return {
      success: true,
    }
  },
}

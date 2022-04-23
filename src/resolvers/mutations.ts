import { MutationResolvers } from '../generated/resolvers-types'

export const mutationResolvers: MutationResolvers = {
  wipeNotionDatabase: async (_, args, { notionAccess, user }) => {
    const archivedIDs = await notionAccess.wipeNotionDatabase(
      user.userfrontID,
    )
    return archivedIDs
  },
  deleteNotionTableProperties: async (_, args, { notionAccess, user }) => {
    const deletedProperties =
      await notionAccess.deleteNotionTableProperties(
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
        message: `The recipient ${toAddress} does not exist`,
      }
    }

    const notionEmailId = await notionAccess.addEmailToNotion({
      newEmail,
      userfrontID: userMeta.userfrontID,
    })

    return notionEmailId
  },
}

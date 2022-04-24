import { MutationResolvers } from '../generated/resolvers-types'

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
  addEmailToNotion: async (_, args, { notionAccess, user }) => {
    const addedEmail = await notionAccess.addEmailToNotion({
      newEmail: args,
      userfrontID: user.userfrontID,
    })
    return addedEmail
  },
  updateDecoEmail: async (_, args, { dbAccess, user }) => {
    const e = await dbAccess.updateDecoEmail(
      user.userfrontID,
      args.emailAddress,
    )
    console.log(e)
    return true
  },
}

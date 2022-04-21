import { MutationResolvers } from '../generated/resolvers-types'

export const mutationResolvers: MutationResolvers = {
  wipeNotionDatabase: async (parent, args, context) => {
    const archivedIDs = await context.notionAccess.wipeNotionDatabase(
      args.userfrontID,
    )
    return archivedIDs
  },
  deleteNotionTableProperties: async (parent, args, context) => {
    const deletedProperties =
      await context.notionAccess.deleteNotionTableProperties()
    return deletedProperties
  },
  formatNotionTable: async (parent, args, context) => {
    const formattedTable = await context.notionAccess.formatNotionTable()
    return formattedTable
  },
  addEmailToNotion: async (parent, args, context) => {
    const addedEmail = await context.notionAccess.addEmailToNotion(args)
    return addedEmail
  },
}

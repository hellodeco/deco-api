import { MutationResolvers } from '../generated/resolvers-types'

export const mutationResolvers: MutationResolvers = {
  wipeNotionDatabase: async (parent, args, context) => {
    const archivedIDs = await context.notionAccess.wipeNotionDatabase()
    return archivedIDs
  },
  deleteNotionTableProperties: async (parent, args, context) => {
    await context.notionAccess.deleteNotionTableProperties()
    return true
  },
}

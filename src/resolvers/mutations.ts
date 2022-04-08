import { MutationResolvers } from '../generated/resolvers-types'

export const mutationResolvers: MutationResolvers = {
  wipeNotionDatabase: async (parent, args, context) => {
    const archivedIDs = await context.notionAccess.wipeNotionDatabase()
    console.log(archivedIDs)
    return archivedIDs
  },
}

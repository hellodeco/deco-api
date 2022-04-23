import { rule, shield } from 'graphql-shield'

/**
 * @reference use the "contextual" cache to help keep this rule fast
 * https://graphql-shield.vercel.app/docs/rules#cache
 */
const isAuthenticated = rule({ cache: 'contextual' })((parent, args, { user }) => {
  return Boolean(user?.userfrontID)
})

const isEmailAdaptor = rule()((parent, args, ctx, info) => {
  /**
   * @todo scope this to only allow requests originating from the email adaptor
   */
  return true
})

const permissions = shield({
  Query: {
    currentUser: isAuthenticated,
    emailAddressAvailable: isAuthenticated,
  },
  Mutation: {
    wipeNotionDatabase: isAuthenticated,
    deleteNotionTableProperties: isAuthenticated,
    formatNotionTable: isAuthenticated,
    addEmailToNotion: isEmailAdaptor,
  }
})

export default permissions

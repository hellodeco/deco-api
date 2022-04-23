import { rule, shield } from 'graphql-shield'

const isAuthenticated = rule()((parent, args, { user }) => {
  return Boolean(user?.userfrontID)
})

const isEmailAdaptor = rule()((parent, args, {}) => {
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

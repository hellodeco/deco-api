import { rule, shield } from 'graphql-shield'

const isAuthenticated = rule()((parent, args, { user }) => {
  return Boolean(user?.userfrontID)
})

const permissions = shield({
  Query: {
    allEmails: isAuthenticated,
    currentUser: isAuthenticated,
    emailAddressAvailable: isAuthenticated,
    getNotionIntegrationByUserfrontID: isAuthenticated,
  },
  Mutation: {
    wipeNotionDatabase: isAuthenticated,
    deleteNotionTableProperties: isAuthenticated,
    formatNotionTable: isAuthenticated,
    updateDecoEmail: isAuthenticated,
    /**
     * @todo scope this to only allow requests originating from the email adaptor
     */
    addEmailToNotion: isAuthenticated,
  },
})

export default permissions

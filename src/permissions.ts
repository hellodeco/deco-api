import { rule, shield } from 'graphql-shield'

/**
 * These rules are executed on a per field basis.
 * Using the cache option "contextual" helps speed up request validation if
 * you only need to use the context (3rd) argument in the rule callback function.
 * @reference https://graphql-shield.vercel.app/docs/rules#cache
 */
const isAuthenticated = rule({ cache: 'contextual' })(
  (parent, args, { user }) => {
    return Boolean(user?.userfrontID)
  },
)

const isEmailAdaptor = rule({ cache: 'contextual' })(
  (parent, args, { emailAdaptorPassword, requestOrigin }, info) => {
    return (
      emailAdaptorPassword === process.env.EMAIL_ADAPTOR_PASSWORD &&
      requestOrigin === process.env.EMAIL_ADAPTOR_DOMAIN
    )
})

const permissions = shield({
  Query: {
    currentUser: isAuthenticated,
    getCurrentUserNotionIntegration: isAuthenticated,
    emailUsernameAvailable: isAuthenticated,
  },
  Mutation: {
    wipeNotionDatabase: isAuthenticated,
    deleteNotionTableProperties: isAuthenticated,
    formatNotionTable: isAuthenticated,
    updateDecoEmail: isAuthenticated,
    addEmailToNotion: isEmailAdaptor,
  },
})

export default permissions

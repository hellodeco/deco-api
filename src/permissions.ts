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

const isEmailAdaptor = rule()((parent, args, ctx, info) => {
  /**
   * @todo scope this to only allow requests originating from the email adaptor
   */
  return true
})

const permissions = shield(
  {
    Query: {
      getUserMetaByDecoEmail: isAuthenticated,
      currentUser: isAuthenticated,
      getCurrentUserNotionIntegration: isAuthenticated,
      emailUsernameAvailable: isAuthenticated,
      getCurrentUserNotionDatabaseInfo: isAuthenticated,
    },
    Mutation: {
      wipeNotionDatabase: isAuthenticated,
      deleteNotionTableProperties: isAuthenticated,
      formatNotionTable: isAuthenticated,
      setDecoEmail: isAuthenticated,
      addEmailToNotion: isEmailAdaptor,
    },
  },
  {
    fallbackRule: isAuthenticated,
  }
)

export default permissions

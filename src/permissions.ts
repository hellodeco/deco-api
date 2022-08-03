import { rule, shield } from 'graphql-shield'
import { ResolverContext } from './types/shared'
import { FRONTEND_DOMAIN } from './constants'

/**
 * These rules are executed on a per field basis.
 * Using the cache option "contextual" helps speed up request validation if
 * you only need to use the context (3rd) argument in the rule callback function.
 * @reference https://graphql-shield.vercel.app/docs/rules#cache
 */
const isAuthenticated = rule({ cache: 'contextual' })(
  (parent, args, { user }: ResolverContext) => {
    return Boolean(user?.userfrontID)
  },
)

const isDecoFrontend = rule({ cache: 'contextual' })((_, args, ctx: ResolverContext) => {
  const { referer } = ctx.headers
  const url = new URL(referer || '')

  return url.host === FRONTEND_DOMAIN
})

const permissions = shield(
  {
    Query: {
      currentUser: isAuthenticated,
      getCurrentUserNotionIntegration: isAuthenticated,
      emailUsernameAvailable: isAuthenticated,
      getCurrentUserNotionDatabaseInfo: isAuthenticated,
      emailDomain: isAuthenticated,
      connectedNotionPages: isAuthenticated,
    },
    Mutation: {
      wipeNotionDatabase: isAuthenticated,
      deleteNotionTableProperties: isAuthenticated,
      formatNotionTable: isAuthenticated,
      setDecoEmail: isAuthenticated,
      createUserfrontAndDecoUser: isDecoFrontend,
      selectNotionDatabase: isAuthenticated,
    },
  },
  {
    // I want this to work but it's causing some GD issues so commenting it out for now
    // fallbackRule: isAuthenticated,
  },
)

export default permissions

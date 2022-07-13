import { isArray } from 'lodash'
import { QueryResolvers } from '../generated/resolvers-types'
import { EMAIL_DOMAIN } from '../constants'
import { reservedUsernames } from '../reservedUsernames'
import { ResolverContext } from '../types/shared'

export const REQUIRED_NOTION_DATABASE_PROPERTIES = [
  'From',
  'Delivered',
  'Email_ID',
  'Name',
]

export const queryResolvers: QueryResolvers<ResolverContext> = {
  currentUser: async (parent, args, { dbAccess, user }) => {
    const userMeta = await dbAccess.getUserByUserfrontID(user.userfrontID)
    return {
      fullName: userMeta.fullName,
      emailAddress: userMeta.emailAddress,
      signupEmail: userMeta.signupEmail,
      userfrontID: user.userfrontID,
    }
  },
  emailUsernameAvailable: async (parent, { username }, { dbAccess }) => {
    if (reservedUsernames.has(username)) {
      return false
    }

    const email = `${username}@${EMAIL_DOMAIN}`
    const userMeta = await dbAccess.getUserByDecoEmail(email)

    return userMeta ? false : true
  },
  getCurrentUserNotionIntegration: async (parent, args, { dbAccess, user }) => {
    // omit the access token since it is a sensitive value and not needed for front end code
    const { accessToken, id, ...integration } =
      await dbAccess.getNotionIntegrationByUserfrontID(user.userfrontID)

    if (!accessToken) {
      return null
    }

    return {
      id: String(id),
      ...integration,
    }
  },
  getCurrentUserNotionDatabaseInfo: async (
    parent,
    args,
    { notionAccess, user, db },
  ) => {
    try {
      const notionIntegration = await db.notionIntegrations()
        .where('userfront_user_id', user.userfrontID)
        .select('id' ,'access_token')
        .first()
      
      if (!notionIntegration) {
        return null
      }

      const notionDatabase = await db.notionDatabases()
        .where('notion_integration_id', notionIntegration.id)
        .select('notion_database_id')
        .first()

      if (!notionDatabase) {
        return null
      }

      const { notionDatabaseId } = notionDatabase

      const notionDBResp = await notionAccess.notionDatabaseInfo({
        notionIntegration,
        notionDatabaseId,
      })

      if (!notionDBResp) {
        return null
      }

      const dbProperties = Object.keys(notionDBResp.properties)

      // Check to see if the database has the correct properties required to receive emails
      const containsAll = REQUIRED_NOTION_DATABASE_PROPERTIES.every((propKey) => {
        return dbProperties.includes(propKey)
      })

      return {
        // @ts-ignore
        title: notionDBResp?.title?.[0]?.plain_text,
        // @ts-ignore
        url: notionDBResp?.url,
        // @ts-ignore
        icon: notionDBResp?.icon?.emoji,
        needsFormatting: !containsAll,
      }
    } catch (err) {
      console.error(err)
    }
  },
  currentUserConnectedNotionPages: async (
    parent,
    args,
    { notionAccess, user, db },
  ) => {
    let notionPages = []
    try {
      const notionDBs = await notionAccess.getNotionDatabases(user.userfrontID)
      if (isArray(notionDBs?.results)) {
        notionPages = notionDBs.results
      }
    } catch (err) {
      console.error(err)
    }

    console.log(notionPages)

    return notionPages.map(({ id, title, url, icon }) => {
      return {
        id,
        title: title?.[0]?.plain_text,
        url,
        icon,
      }
    })
  },
  emailDomain: async () => {
    return EMAIL_DOMAIN
  },
}

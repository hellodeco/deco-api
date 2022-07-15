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
      const notionIntegration = await db
        .notionIntegrations()
        .where('userfront_user_id', user.userfrontID)
        .select('id', 'access_token')
        .first()

      if (!notionIntegration) {
        return null
      }

      const notionDatabase = await db
        .notionDatabases()
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

      // @ts-ignore Typescript you're goddamn high!
      const dbProperties = Object.keys(notionDBResp.properties)

      // Check to see if the database has the correct properties required to receive emails
      const containsAll = REQUIRED_NOTION_DATABASE_PROPERTIES.every(
        (propKey) => {
          return dbProperties.includes(propKey)
        },
      )

        const title =
          // @ts-ignore
          notionDBResp.title?.[0]?.plain_text ||
          // @ts-ignore
          notionDBResp.properties?.title?.title?.[0]?.plain_text ||
          'Untitled Notion Page'

      const needsManualFormatting = notionDBResp.object === 'page'

      const data = {
        title,
        needsManualFormatting,
        // @ts-ignore
        url: notionDBResp?.url,
        // @ts-ignore
        icon: notionDBResp?.icon?.emoji, // only supporting emoji icon for now
        needsFormatting: !containsAll,
      }

      return data
    } catch (err) {
      console.error(err)
    }
  },
  connectedNotionPages: async (parent, args, { notionAccess, user, db }) => {
    try {
      const [sharedDBs, sharedPages] = await Promise.all([
        notionAccess.getSharedNotionDatabases(user.userfrontID),
        notionAccess.getSharedNotionPages(user.userfrontID),
      ])

      // filter out any notion pages that are not top level
      const topLevelFilter = (page) => {
        // @ts-ignore - TS can not figure its goddamn shit out with this one
        const { parent } = page
        return parent?.type === 'workspace' && parent?.workspace === true
      }

      // format the icon object on each page
      const iconMapper = (page) => {
        if (!page.icon) {
          page.icon = { type: 'emoji', emoji: '📁' }
        }

        if (['file', 'external'].includes(page.icon.type)) {
          page.icon.url = page.icon[page.icon?.type]?.url || null
        }

        return page
      }

      // get the expected fields for the resolver return type
      const fieldMapper = (page) => {
        let { id, title, url, icon } = page
        return { id, title, url, icon }
      }

      const topLevelDBs = sharedDBs
        .filter(topLevelFilter)
        .map((page) => {
          // @ts-ignore
          let title = page?.title?.[0]?.plain_text || 'Untitled Notion Page'

          return {
            ...page,
            title,
          }
        })

        .map(iconMapper)

      const topLevelPages = sharedPages.filter(topLevelFilter).map((page) => {
        const title =
          // @ts-ignore
          page.title ||
          // @ts-ignore
          page?.properties?.title?.title?.[0]?.plain_text ||
          'Untitled Notion Page'

        return {
          ...page,
          title,
        }
      })

      const allPages = [...topLevelDBs, ...topLevelPages]
        .map(iconMapper)
        .map(fieldMapper)

      return allPages
    } catch (err) {
      console.error(err)
    }

    return []
  },
  emailDomain: async () => {
    return EMAIL_DOMAIN
  },
}

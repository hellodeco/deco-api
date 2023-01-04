import { QueryResolvers } from '../generated/resolvers-types'
import { EMAIL_DOMAIN } from '../constants'
import { reservedUsernames } from '../reservedUsernames'
import { ResolverContext } from '../types/shared'
import { User, EmailAttachment } from '../types/database'
import { objectCamelToSnake } from '../utils'

export const REQUIRED_NOTION_DATABASE_PROPERTIES = [
  'From',
  'Delivered',
  'Email_ID',
  'Name',
]

export const queryResolvers: QueryResolvers<ResolverContext> = {
  currentUser: async (parent, args, { dbAccess, user }) => {
    const userMeta = await dbAccess.getUserByUserfrontID(user.userfrontID)
    const subscription = await dbAccess.getSubscriptionByUserfrontUserId(
      user.userfrontID,
    )

    return {
      fullName: userMeta.fullName,
      emailAddress: userMeta.emailAddress,
      signupEmail: userMeta.signupEmail,
      userfrontID: user.userfrontID,
      subscriptionStatus: subscription?.subscriptionStatus,
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

      const notionDatabases = await db
        .notionDatabases()
        .where('notion_integration_id', notionIntegration.id)
        .select('notion_database_id', 'type')

      if (!notionDatabases) {
        return null
      }

      const responseData = await Promise.all(
        notionDatabases.map(async (notionDatabase) => {
          const { notionDatabaseId, type } = notionDatabase

          const notionDBResp = await notionAccess.notionDatabaseInfo({
            notionIntegration,
            notionDatabaseId,
          })

          if (!notionDBResp) {
            return null
          }

          // @ts-ignore Typescript you're goddamn high!
          const dbProperties = Object.keys(notionDBResp.properties)

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
            type: type,
          }

          return data
        }),
      )

      return responseData
    } catch (err) {
      console.error(err)
    }
  },

  connectedNotionPages: async (parent, args, { notionAccess, user, db }) => {
    try {
      // we only want to query for databases, not pages
      const [sharedDBs] = await Promise.all([
        notionAccess.getSharedNotionDatabases(user.userfrontID),
      ])

      // format the icon object on each page/database
      const iconMapper = (page) => {
        if (!page.icon) {
          // default emoji icon if none exists
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

      const formattedDBs = sharedDBs
        .map((page) => {
          // @ts-ignore
          let title = page?.title?.[0]?.plain_text || 'Untitled Notion Page'

          return {
            ...page,
            title,
          }
        })
        .map(iconMapper)

      const allDatabases = [...formattedDBs].map(iconMapper).map(fieldMapper)

      return allDatabases
    } catch (err) {
      console.error(err)
    }

    return []
  },

  emailDomain: async () => {
    return EMAIL_DOMAIN
  },

  currentUserHasFileAccess: async (parent, { attachmentId }, { db, user }) => {
    let dbUser: User
    try {
      dbUser = await db
        .users()
        .where('userfront_user_id', user.userfrontID)
        .select('userfront_user_id')
        .first()
    } catch (err) {
      console.error(err)
    }

    if (!dbUser) {
      return false
    }

    let attachment: EmailAttachment

    try {
      attachment = await db
        .emailAttachments()
        .where(
          objectCamelToSnake({
            userfrontUserId: user.userfrontID,
            uuid: attachmentId,
          }),
        )
        .first()
    } catch (err) {
      console.error(err)
    }

    console.log('attachment', attachment)

    return Boolean(attachment)
  },
}

import { isArray, isString } from 'lodash'
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

      const dbProperties = Object.keys(notionDBResp.properties)

      // Check to see if the database has the correct properties required to receive emails
      const containsAll = REQUIRED_NOTION_DATABASE_PROPERTIES.every(
        (propKey) => {
          return dbProperties.includes(propKey)
        },
      )

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
      /**
       * page.icon can be one of:
       * {
       *    type: 'external',
       *    external: {
       *      url: 'https://images.unsplash.com/photo-1657769311349-2b2eea385393?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1935&q=80'
       *    }
       * }
       * { type: 'emoji', emoji: '📕' }
i      * {
       *   type: 'file',
       *   file: {
       *     url: 'https://s3.us-west-2.amazonaws.com/secure.notion-static.com/191a95c7-9a80-4634-8c93-0daeb9cc723f/hellodeco.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAT73L2G45EIPT3X45%2F20220714%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date=20220714T170308Z&X-Amz-Expires=3600&X-Amz-Signature=6fa6fa5b0f936bb27a5408a83f5a868b581611608faea61a85c1f27c713b30d3&X-Amz-SignedHeaders=host&x-id=GetObject',
       *     expiry_time: '2022-07-14T18:03:08.922Z'
       *   }
       * }
       */

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
        // @ts-ignore
        const title =
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

      console.log('shared dbs', topLevelDBs)

      console.log('shared pages', topLevelPages)

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

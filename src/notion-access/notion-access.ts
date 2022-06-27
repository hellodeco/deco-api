import { Client } from '@notionhq/client'
import 'dotenv/config'
import {
  getNotionIntegrationByUserfrontID,
  getNotionDatabaseIDByUsefrontID,
  createOrUpdateNotionDatabase,
} from '../db-access/db-access'
import type { NotionIntegration } from '../db-access/db-access'
import { REQUIRED_NOTION_DATABASE_PROPERTIES } from '../constants'

export interface NewEmail {
  subject: string
  from: string
  emailId?: number
  emailThreadId?: number
  plainTextContent: string
}

interface NotionConnectData {
  notion?: Client
  notionDatabaseId?: string
}

export const getNotionDatabaseID = async ({
  accessToken,
}: {
  accessToken: string
}): Promise<{ notionDatabaseId?: string }> => {
  const notion = new Client({ auth: accessToken })
  let notionDatabaseId = null

  try {
    /**
     * @todo if the notion page shared is ***not*** a full page database type than this will not return anything
     * and then future stuff will error because we won't save a new entry in table notion_databases table.
     * This fails silently and is very confusing so we should make this process smoother for the user
     * 
     * ***** Notion imposed limit *****
     * - Only top level Notion pages are allowed
     * 
     * ***** Ideas *****
     * - store a "health" field in the notion_database table and if this is "false" then we can tell the user to self troubleshoot common problems
     */
    // this returns ALL databases that the user has shared with us
    // because they _should_ only be sharing one DB to start, we can take the first result
    // HOWEVER we will have to figure out a better solution once we allow multiple integrations.
    const searchResponse = await notion.search({
      filter: {
        property: 'object',
        value: 'database',
      },
    })

    notionDatabaseId = searchResponse?.results[0]?.id

    console.log('search resp', searchResponse, notionDatabaseId)
  } catch (err) {
    console.error(err)
  }

  return { notionDatabaseId }
}

const getClientAndWorkspaceID = async (
  userfrontID: string,
): Promise<NotionConnectData> => {
  const notionIntegration = await getNotionIntegrationByUserfrontID(userfrontID)

  const notion = new Client({ auth: notionIntegration.accessToken })

  const notionDB = await getNotionDatabaseIDByUsefrontID(userfrontID)

  return {
    notion,
    notionDatabaseId: notionDB?.notionDatabaseId,
  }
}

export const wipeNotionDatabase = async (userfrontID: string) => {
  const { notion, notionDatabaseId } = await getClientAndWorkspaceID(
    userfrontID,
  )

  const response = await notion.databases.query({
    database_id: notionDatabaseId,
  })

  const promises = []
  const archivedPageTitles = []

  response.results.forEach((result) => {
    promises.push(
      notion.pages.update({
        page_id: result.id,
        archived: true,
      }),
    )
    archivedPageTitles.push(result.id)
  })

  await Promise.all(promises)
  return archivedPageTitles
}

export const deleteNotionTableProperties = async (userfrontID: string) => {
  const { notion, notionDatabaseId } = await getClientAndWorkspaceID(
    userfrontID,
  )

  const response = await notion.databases.retrieve({
    database_id: notionDatabaseId,
  })

  const properties = response.properties

  const deletedProperties = []

  const props = Object.values(properties)

  for (let p of props) {
    if (p.id !== 'title') {
      let res = await notion.databases.update({
        database_id: notionDatabaseId,
        properties: {
          [p.id]: null,
        },
      })
      deletedProperties.push(p.name)
    }
  }

  return deletedProperties
}

export const formatNotionTable = async (userfrontID: string) => {
  const { notion, notionDatabaseId } = await getClientAndWorkspaceID(
    userfrontID,
  )

  const response = await notion.databases.retrieve({
    database_id: notionDatabaseId,
  })

  const properties = response.properties

  const props = Object.values(properties)

  if (props.length > 1 || props[0].id !== 'title') {
    console.log(
      'Looks like there are too many existing properties in the table.',
    )
    return false
  }

  await notion.databases.update({
    database_id: notionDatabaseId,
    properties: {
      From: {
        type: 'email',
        email: {},
      },
      Delivered: {
        type: 'date',
        date: {},
      },
      Email_ID: {
        type: 'number',
        number: {},
      },
    },
  })

  return true
}

export const addEmailToNotion = async ({
  newEmail,
  userfrontID,
}: {
  newEmail: NewEmail
  userfrontID: string
}) => {
  const { notion, notionDatabaseId } = await getClientAndWorkspaceID(
    userfrontID,
  )

  const { subject, from, emailId, emailThreadId, plainTextContent } = newEmail

  const time = Date.now()
  const deliveryDate = new Date(time)
  const deliveryDateAsISOString = deliveryDate.toISOString()

  const emailCreated = await notion.pages.create({
    parent: { database_id: notionDatabaseId },
    properties: {
      title: {
        title: [
          {
            text: {
              content: subject,
            },
          },
        ],
      },
      From: {
        email: from,
      },
      Delivered: {
        date: {
          start: deliveryDateAsISOString,
        },
      },
      Email_ID: {
        number: emailId,
      },
    },
    children: [
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: plainTextContent,
              },
            },
          ],
        },
      },
    ],
  })

  return emailCreated.id
}

export const getCurrentUserNotionDatabaseInfo = async (userfrontID: string) => {
  let notionDatabaseInfo = null
  try {

    const { notion, notionDatabaseId } = await getClientAndWorkspaceID(
      userfrontID,
    )

    const response: any = await notion.databases.retrieve({
      database_id: notionDatabaseId,
    })

    const dbProperties = Object.keys(response.properties)

    // Check to see if the database has the correct properties required to receive emails
    const containsAll = REQUIRED_NOTION_DATABASE_PROPERTIES.every((propKey) => {
      return dbProperties.includes(propKey)
    })

    notionDatabaseInfo = {
      title: response?.title?.[0]?.plain_text,
      url: response?.url,
      icon: response?.icon?.emoji,
      needsFormatting: !containsAll,
    }
  } catch(err) {
    console.error(err)
  }

  return notionDatabaseInfo
}

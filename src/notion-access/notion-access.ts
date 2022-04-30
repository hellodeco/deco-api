import { Client } from '@notionhq/client'
import 'dotenv/config'
import {
  getNotionIntegrationByUserfrontID,
  getNotionDatabaseIDByUsefrontID,
  createOrUpdateNotionDatabase,
} from '../db-access/db-access'

export interface NewEmail {
  newEmail: {
    subject: string
    from: string
    emailID: number
    emailThreadID: number
    plainTextContent: string
  }
}

export interface NotionConnectData {
  notion?: Client
  notionDatabaseId?: string
}

export const setNotionDatabaseID = async (
  userfrontID: string,
): Promise<NotionConnectData> => {
  const notionIntegration = await getNotionIntegrationByUserfrontID(userfrontID)

  const notion = new Client({ auth: notionIntegration.accessToken })

  // this returns ALL databases that the user has shared with us
  // because they _should_ only be sharing one DB to start, we can take the first result
  // HOWEVER we will have to figure out a better solution once we allow multiple integrations.
  const searchResponse = await notion.search({
    filter: {
      property: 'object',
      value: 'database',
    },
  })

  const notionDatabaseId = searchResponse.results[0].id

  await createOrUpdateNotionDatabase({
    notionIntegrationId: notionIntegration.id,
    notionDatabaseId: notionDatabaseId,
  })
  return { notionDatabaseId: notionDatabaseId }
}

const getClientAndWorkspaceID = async (
  userfrontID: string,
): Promise<NotionConnectData> => {
  const notionIntegration = await getNotionIntegrationByUserfrontID(userfrontID)

  const notion = new Client({ auth: notionIntegration.accessToken })

  const notionDB = await getNotionDatabaseIDByUsefrontID(userfrontID)

  return { notion: notion, notionDatabaseId: notionDB.notionDatabaseId }
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
      console.log(res)
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
      Email_Thread_ID: {
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

  const { subject, from, emailID, emailThreadID, plainTextContent } =
    newEmail.newEmail

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
        number: emailID,
      },
      Email_Thread_ID: {
        number: emailThreadID,
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

export const getNotionDatabaseInfo = async (userfrontID: string) => {
  const { notion, notionDatabaseId } = await getClientAndWorkspaceID(
    userfrontID,
  )

  const response: any = await notion.databases.retrieve({
    database_id: notionDatabaseId,
  })

  const notionDatabaseInfo = {
    title: response.title[0].plain_text,
    url: response.url,
    icon: response.icon?.emoji,
  }

  return notionDatabaseInfo
}

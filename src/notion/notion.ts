import { Client } from '@notionhq/client'
import 'dotenv/config'
import { db } from '../db-connection'

export const REQUIRED_NOTION_DATABASE_PROPERTIES = [
  'From',
  'Delivered',
  'Email_ID',
  'Name',
]

export interface NewEmail {
  subject: string
  from: string
  emailId?: number
  emailThreadId?: number
  plainTextContent: string
}

export async function getNotionDatabaseIdFromNotion({
  accessToken,
}: {
  accessToken: string
}): Promise<{ notionDatabaseId?: string }> {
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
  } catch (err) {
    console.error(err)
  }

  return { notionDatabaseId }
}

async function notionClient(userfrontID: string): Promise<Client> {
  const notionIntegration = await db.notionIntegrations()
    .where('userfront_user_id', userfrontID)
    .select('accessToken')
    .first()

  const notion = new Client({ auth: notionIntegration.accessToken })

  return notion
}

async function getNotionDatabaseId(userfrontID: string): Promise<string | null> {
  const notionIntegration = await db.notionIntegrations()
    .where('userfront_user_id', userfrontID)
    .select('id')
    .first()

  const notionDB = await db.notionDatabases()
    .where('notion_integration_id', notionIntegration.id)
    .select('notionDatabaseId')
    .first()

  return notionDB?.notionDatabaseId || null
}

export async function wipeNotionDatabase(userfrontID: string) {
  const notion = await notionClient(userfrontID)
  const notionDatabaseId = await getNotionDatabaseId(userfrontID)

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

export async function deleteNotionTableProperties(userfrontID: string) {
  const notion = await notionClient(userfrontID)
  const notionDatabaseId = await getNotionDatabaseId(userfrontID)

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

export async function formatNotionTable(userfrontID: string) {
  const notion = await notionClient(userfrontID)
  const notionDatabaseId = await getNotionDatabaseId(userfrontID)

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

export async function addEmailToNotion({
  newEmail,
  userfrontID,
}: {
  newEmail: NewEmail
  userfrontID: string
}) {
  const notion = await notionClient(userfrontID)
  const notionDatabaseId = await getNotionDatabaseId(userfrontID)

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

export async function getCurrentUserNotionDatabaseInfo(userfrontID: string) {
  let notionDatabaseInfo = null
  try {
    const notionIntegration = await db.notionIntegrations()
      .where('userfront_user_id', userfrontID)
      .select('id accessToken')
      .first()

    if (!notionIntegration) {
      return null
    }

    const notion = new Client({ auth: notionIntegration.accessToken })

    const notionDB = await db.notionDatabases()
      .where('notion_integration_id', notionIntegration.id)
      .select('notionDatabaseId')
      .first()

    const notionDatabaseId = notionDB?.notionDatabaseId

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
  } catch (err) {
    console.error(err)
  }

  return notionDatabaseInfo
}

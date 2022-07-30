import { Client } from '@notionhq/client'
import type {
  GetDatabaseResponse,
  GetPageResponse,
} from '@notionhq/client/build/src/api-endpoints'
import 'dotenv/config'
import { FRONTEND_BASE_URL } from '../constants'
import { db } from '../db-connection'
import type { NotionIntegration } from '../types/database'
import { EmailAttachment } from '../types/database'

/**
 * Notion formatting setup order of operations:
 *
 * 1. connect Notion database(s)
 * 2. if multiple selected ask user to select which one to use
 * 3. detect if single selected page is correct format (full page database)
 * 4. if it isn't ask user to format it correctly and provide instructions (video + written instructions)
 * 5. once it is correct type, ask user to "format". This kicks off the following sequential steps under the hood:
 *     a. wipeNotionDatabase (delete all existing data)
 *     b. deleteNotionTableProperties (delete all existing table properties)
 *     c. formatNotionTable (add table properties)
 *
 * Required code changes for this:
 *
 * 1. Notion callback route will no longer query Notion for databases
 *    a. it won't check that the page is formatted correctly
 *    b. it won't auto choose the first shared page in the notion provided list
 * 2. New API / API functionality to report if multiple pages are shared
 * 3. New API to choose one page to use
 *
 * "Rules" for this
 *
 *   | ***
 *   | notion_database === the database we route mail to. This must be one of the databases
 *   | that the user has explicity shared with us
 *   | ***
 *
 * 1. connecting to notion will only create a notion_integration, not actually choose which shared page
 *    is used for the connected database
 * 2. we will only set one notion_database at a time per user
 * 3. user will be able to change their notion_database
 * 4. user will be able to change their shared notion pages. Once they have done this, we will update the integration
 *    and delete their old notion_database from our database and they will be prompted to reselect the page they want
 *    emails to get routed to
 *
 * Client side logic
 * - Query for notion_integration
 *  - if it doesn't exist display button to connect
 *  - if it exists query for notion_database
 *    - if notion_database exists
 *      - show database info
 *      - show button to connect another db
 *   - if notion_database doesn't exist
 *      - query for list of shared databases and have user select one
 */

export interface NewEmail {
  subject: string
  from: string
  emailId?: number
  emailThreadId?: number
  plainTextContent: string
}

export async function getSharedNotionDatabases(userfrontID: string) {
  try {
    const notion = await notionClient(userfrontID)

    const resp = await notion.search({
      filter: {
        property: 'object',
        value: 'database',
      },
    })

    return resp.results || []
  } catch (err) {
    console.error(err)
  }
}

export async function getSharedNotionPages(userfrontID: string) {
  try {
    const notion = await notionClient(userfrontID)

    const resp = await notion.search({
      filter: {
        property: 'object',
        value: 'page',
      },
    })

    return resp.results || []
  } catch (err) {
    console.error(err)
  }
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

export async function notionClient(userfrontID: string): Promise<Client> {
  const notionIntegration = await db
    .notionIntegrations()
    .where('userfront_user_id', userfrontID)
    .select('access_token')
    .first()

  const notion = new Client({ auth: notionIntegration.accessToken })

  return notion
}

async function getNotionDatabaseId(
  userfrontID: string,
): Promise<string | null> {
  const notionIntegration = await db
    .notionIntegrations()
    .where('userfront_user_id', userfrontID)
    .select('id')
    .first()

  const notionDB = await db
    .notionDatabases()
    .where('notion_integration_id', notionIntegration.id)
    .select('notion_database_id')
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
    console.warn(
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
  attachments = [],
}: {
  newEmail: NewEmail
  userfrontID: string
  attachments?: Array<EmailAttachment>,
}) {
  const notion = await notionClient(userfrontID)
  const notionDatabaseId = await getNotionDatabaseId(userfrontID)

  const { subject, from, emailId, plainTextContent } = newEmail

  const time = Date.now()
  const deliveryDate = new Date(time)
  const deliveryDateAsISOString = deliveryDate.toISOString()

  const content = []

  const attachmentLinks = attachments.reduce((items, { uuid, filename }, idx) => {
    let url = encodeURI(`${FRONTEND_BASE_URL}/files/attachments/${uuid}/${filename}`)
    console.log('url:', url)

    items.push({
      type: 'text',
      text: {
        content: filename,
        link: {
          url: url,
        }
      }
    })

    if (idx !== attachments.length - 1) {
      items.push({
        type: 'text',
        text: {
          content: ', ',
        },
      })
    }

    return items
  }, [])

  const attachmentSection = [
    {
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: 'Attachments: ',
            },
            annotations: {
              bold: true,
            }
          },
          // @ts-ignore
          ...attachmentLinks,
        ]
      },
    },
    {
      type: 'divider',
      divider: {},
    },
  ]

  if (attachments.length > 0) {
    content.push(...attachmentSection)
  }

  return notion.pages.create({
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
      ...content,
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
}

// Returns metadata about the Notion page a user has shared with us
export async function notionDatabaseInfo({
  notionIntegration,
  notionDatabaseId,
}: {
  notionIntegration: NotionIntegration
  notionDatabaseId: string
}): Promise<GetDatabaseResponse | GetPageResponse | null> {
  let notionDatabaseInfo = null
  try {
    const notion = new Client({ auth: notionIntegration.accessToken })

    let resp = null
    try {
      resp = await notion.databases.retrieve({
        database_id: notionDatabaseId,
      })
    } catch (err) {
      console.error(err)
    }

    if (!resp) {
      try {
        resp = await notion.pages.retrieve({
          page_id: notionDatabaseId,
        })
      } catch (err) {
        console.error(err)
      }
    }

    return resp
  } catch (err) {
    console.error(err)
  }

  return notionDatabaseInfo
}

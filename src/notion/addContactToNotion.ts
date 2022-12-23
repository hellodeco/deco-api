import { notionClient } from "./notionClient"
import { Client } from '@notionhq/client'
import { CreatePageResponse } from "@notionhq/client/build/src/api-endpoints"
import { getNotionDatabaseId } from './notion'
import { DatabaseType } from '../types/database'


async function maybeUpdatePageProperties({
  notionContactsDatabaseId,
  notion,
}: {
  notionContactsDatabaseId: string
  notion: Client
}) {
  const notionDB = await notion.databases.retrieve({
    database_id: notionContactsDatabaseId,
  })

  const keys = Object.keys(notionDB.properties)

  const requiredProps = ['Email', 'Name']

  const containsAll = requiredProps.every((element) => {
    return keys.includes(element)
  })

  if (containsAll) {
    return
  }

  // recreate properties needed for email delivery if they don't exist
  // this will not duplicate existing properties
  try {
    await notion.databases.update({
      database_id: notionContactsDatabaseId,
      properties: {
        Email: {
          type: 'email',
          email: {},
        },
        'Full Name': {
          type: 'rich_text',
          rich_text: {},
        },
      },
    })
  } catch (err) {
    console.error('error updating notion database', err)
  }
}

export async function addContactToNotion({
  userfrontID,
  fullName,
  email
}: {
  userfrontID: string
  fullName: string
  email: string
}): Promise<{ contactPage: CreatePageResponse, notionContactsDatabaseId: string } | null> {
  let notion: Client
  try {
    notion = await notionClient(userfrontID)
  } catch (err) {
    console.error(err)
    return null
  }

  const notionContactsDatabaseId = await getNotionDatabaseId(userfrontID, DatabaseType.CONTACTS)

  // no contacts database connected
  if (!notionContactsDatabaseId) {
    return null
  }

  await maybeUpdatePageProperties({
    notionContactsDatabaseId,
    notion,
  })

  let contactExists = false
  let contactPage: CreatePageResponse | null = null

  try {
    const contactResp = await notion.databases.query({
      database_id: notionContactsDatabaseId,
      filter: {
        property: 'Email',
        email: {
          contains: email,
        }
      }
    })

    if (contactResp?.results?.length > 0) {
      contactExists = true
      contactPage = contactResp.results[0]
    }
  } catch(err) {
    console.error('error finding contact with email', err)

    return null
  }

  if (!contactExists) {
    try {
      contactPage = await notion.pages.create({
        parent: { database_id: notionContactsDatabaseId },
        properties: {
          title: {
            title: [
              {
                text: {
                  content: fullName,
                },
              },
            ],
          },
          Email: {
            email: email,
          },
          'Full Name': {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: fullName,
                },
              },
            ],
          },
        },
      })
    } catch (err) {
      console.error('error adding contact to notion', err)
    }
  }

  return {
    contactPage,
    notionContactsDatabaseId,
  }
}

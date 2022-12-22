import { notionClient } from "./notionClient"
import { Client } from '@notionhq/client'
import { CreatePageResponse } from "@notionhq/client/build/src/api-endpoints"
import { getNotionDatabaseId } from './notion'
import { DatabaseType } from '../types/database'


async function maybeUpdatePageProperties({
  notionDatabaseId,
  notion,
}: {
  notionDatabaseId: string
  notion: Client
}) {
  const notionDB = await notion.databases.retrieve({
    database_id: notionDatabaseId,
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
      database_id: notionDatabaseId,
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

    return null
  }
}

export async function addContactToNotion({
  userfrontID,
  fullName,
  fromEmail
}: {
  userfrontID: string
  fullName: string
  fromEmail: string
}) {
  let notion: Client
  try {
    notion = await notionClient(userfrontID)
  } catch (err) {
    console.error(err)
    return null
  }

  const notionDatabaseId = await getNotionDatabaseId(userfrontID, DatabaseType.CONTACTS)

  // no contacts database connected
  if (!notionDatabaseId) {
    return null
  }

  await maybeUpdatePageProperties({
    notionDatabaseId,
    notion,
  })

  let contactExists = false
  let contactPage: CreatePageResponse = null

  try {
    const contactResp = await notion.databases.query({
      database_id: notionDatabaseId,
      filter: {
        property: 'Email',
        email: {
          contains: fromEmail,
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
        parent: { database_id: notionDatabaseId },
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
            email: fromEmail,
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

  return contactPage
}

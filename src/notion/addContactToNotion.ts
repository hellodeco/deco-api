import { notionClient } from './notionClient'
import { Client } from '@notionhq/client'
import type {
  CreatePageResponse,
  UpdateDatabaseParameters,
  DatabaseObjectResponse,
} from '@notionhq/client/build/src/api-endpoints'
import { getNotionDatabaseId } from './notion'
import { DatabaseType } from '../types/database'

export async function maybeUpdateContactsPageProperties({
  notionContactsDatabaseId,
  notionEmailDatabaseId,
  notionClient,
}: {
  notionContactsDatabaseId: string
  notionEmailDatabaseId: string
  notionClient: Client
}) {
  const notionDB = await notionClient.databases.retrieve({
    database_id: notionContactsDatabaseId,
  })

  const keys = Object.keys(notionDB.properties)

  // the email relationship property name is dynamic and auto created
  // by the notion api, so we need to find it
  let emailsRelationProp: DatabaseObjectResponse['properties']['relation'] =
    null

  for (let [, value] of Object.entries(notionDB.properties)) {
    // @ts-ignore b/c tsc can't figure this one out
    if (value.relation?.database_id === notionEmailDatabaseId) {
      emailsRelationProp = value
      break
    }
  }

  // TODO: add 'Last Email' and 'Emails'
  const requiredProps = ['Email', 'Bio', 'Last Email']

  // recreate properties needed for email delivery if they don't exist
  // this will not duplicate existing properties
  const updatePayload: UpdateDatabaseParameters = {
    database_id: notionContactsDatabaseId,
    properties: {
      Email: {
        type: 'email',
        email: {},
      },
      Bio: {
        type: 'rich_text',
        rich_text: {},
      },
    },
  }

  if (emailsRelationProp) {
    requiredProps.push(emailsRelationProp.name)

    updatePayload.properties[emailsRelationProp.name] = {
      type: 'relation',
      relation: {
        type: 'dual_property',
        database_id: notionEmailDatabaseId,
        dual_property: {},
      },
    }

    updatePayload.properties['Last Email'] = {
      type: 'rollup',
      rollup: {
        // relation_property_id: emailsRelationProp.id,
        relation_property_name: emailsRelationProp.name,
        // TODO store the id and use that instead for this
        rollup_property_name: 'Delivered',
        function: 'latest_date',
      },
    }
  }

  const containsAll = requiredProps.every((element) => {
    return keys.includes(element)
  })

  if (containsAll) {
    return
  }

  try {
    await notionClient.databases.update(updatePayload)
  } catch (err) {
    console.error('error updating notion database', err)
  }
}

export async function addContactToNotion({
  userfrontID,
  fullName,
  email,
}: {
  userfrontID: string
  fullName: string
  email: string
}): Promise<{
  contactPage: CreatePageResponse
  notionContactsDatabaseId: string
} | null> {
  let notion: Client
  try {
    notion = await notionClient(userfrontID)
  } catch (err) {
    console.error(err)
    return null
  }

  const notionContactsDatabaseId = await getNotionDatabaseId(
    userfrontID,
    DatabaseType.CONTACTS,
  )
  const notionEmailDatabaseId = await getNotionDatabaseId(
    userfrontID,
    DatabaseType.EMAIL,
  )

  // no contacts database connected
  if (!notionContactsDatabaseId) {
    return null
  }

  await maybeUpdateContactsPageProperties({
    notionContactsDatabaseId,
    notionEmailDatabaseId,
    notionClient: notion,
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
        },
      },
    })

    if (contactResp?.results?.length > 0) {
      contactExists = true
      contactPage = contactResp.results[0]
    }
  } catch (err) {
    console.error('error finding contact with email', err)

    return null
  }

  if (!contactExists) {
    try {
      contactPage = await notion.pages.create({
        parent: { database_id: notionContactsDatabaseId },
        properties: {
          Name: {
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
          Bio: {
            rich_text: [],
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

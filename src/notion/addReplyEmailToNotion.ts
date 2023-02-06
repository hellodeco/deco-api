import { Client } from '@notionhq/client'
import type {
  UpdateDatabaseParameters,
  CreatePageParameters,
} from '@notionhq/client/build/src/api-endpoints'
import 'dotenv/config'
import { NotionDatabaseType } from '../types/database'
import { getEmailFromEmailToStr } from '../utils'
import { getNotionDatabaseId } from './notion'
import { getSubscriptionByUserfrontUserId } from '../db-access/db-access'
import { FRONTEND_BASE_URL } from '../constants'

export interface NewReply {
  subject: string
  to: string
  from: string
  inReplyTo: string
  emailThreadId: number
  plainTextContent: string
  createdAt: string
}

export async function addReplyEmailToNotion({
  newReply,
  userfrontID,
  originalEmailUUID,
  notionClient,
}: {
  newReply: NewReply
  userfrontID: string
  originalEmailUUID: string
  notionClient: Client
}): Promise<{
  pageId: string
  notionEmailDatabaseId: string
  notionPageUrl: string
} | null> {
  try {
    const existingSubscription = await getSubscriptionByUserfrontUserId(
      userfrontID,
    )

    if (
      !existingSubscription ||
      existingSubscription.subscriptionStatus !== 'active'
    ) {
      return null
    }

    const notionDatabaseId = await getNotionDatabaseId(
      userfrontID,
      NotionDatabaseType.EMAIL,
    )

    // TODO rename InReplyTo to In_Reply_To from consistency with the other property names we add.
    const requiredProps = ['To', 'From', 'InReplyTo', 'Delivered', 'UUID']

    const updatePayload: UpdateDatabaseParameters = {
      database_id: notionDatabaseId,
      properties: {
        To: {
          type: 'email',
          email: {},
        },
        From: {
          type: 'email',
          email: {},
        },
        InReplyTo: {
          type: 'relation',
          relation: {
            // TODO remove this and actually figure out the type here.
            // @ts-ignore
            type: 'dual_property',
            database_id: notionDatabaseId,
            dual_property: {},
          },
        },
        Delivered: {
          type: 'date',
          date: {},
        },
        UUID: {
          type: 'rich_text',
          rich_text: {},
        },
      },
    }

    const notionDB = await notionClient.databases.retrieve({
      database_id: notionDatabaseId,
    })

    const keys = Object.keys(notionDB.properties)

    const containsAll = requiredProps.every((element) => {
      return keys.includes(element)
    })

    // recreate properties needed for email delivery if they don't exist
    // this will not duplicate existing properties
    if (!containsAll) {
      await notionClient.databases.update(updatePayload)
    }

    const { to, subject, from, inReplyTo } = newReply

    const deliveryDate = new Date(newReply.createdAt)
    const deliveryDateAsISOString = deliveryDate.toISOString()

    const createEmailPagePayload: CreatePageParameters = {
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
        To: {
          email: getEmailFromEmailToStr(to) || '',
        },
        From: {
          email: getEmailFromEmailToStr(from) || '',
        },
        InReplyTo: {
          relation: [
            {
              id: inReplyTo,
            },
          ],
        },
        Delivered: {
          date: {
            start: deliveryDateAsISOString,
          },
        },
      },
    }

    const pageCreateResp = await notionClient.pages.create(createEmailPagePayload)

    // @ts-ignore because the CreatePageResponse interface is missing some fields that do exist
    const { status, url, id: notionPageID } = pageCreateResp

    if (status === 429) {
      const message = `user with id ${userfrontID} is hitting notion api rate limits during page creation`
      console.warn(message)
      throw new Error(message)
    }

    if (status === 404) {
      const message = `notion database with id ${notionDatabaseId} could not be found`
      console.warn(message)
      throw new Error(message)
    }

    const pageId = pageCreateResp.id

    await notionClient.blocks.children.append({
      block_id: pageId,
      children: [
        {
          type: 'callout',
          callout: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: 'Send this email',
                  // TODO - replace with correct URL for sending once we build it
                  link: {
                    url: `${FRONTEND_BASE_URL}/email/reply/send/${originalEmailUUID}/${pageId}`,
                  },
                },
              },
            ],
            icon: {
              emoji: '▶️',
            },
            color: 'default',
          },
        },
      ],
    })

    return {
      pageId,
      notionEmailDatabaseId: notionDatabaseId,
      notionPageUrl: url,
    }
  } catch (err) {
    console.error('error adding reply email to notion', err)
    throw new Error(`error adding reply email to notion: ${err.message}`)
  }
}

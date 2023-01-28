import { Client } from '@notionhq/client'
import type {
  UpdateDatabaseParameters,
  CreatePageParameters,
} from '@notionhq/client/build/src/api-endpoints'
import 'dotenv/config'
import { NotionDatabaseType } from '../types/database'
import { createPlainTextBlocks } from './createPlainTextBlocks'
import { chunkArr, getEmailFromEmailToStr } from '../utils'
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
}): Promise<{ pageId: string; notionEmailDatabaseId: string; notionPageUrl: string } | null> {
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
    // let { plainTextContent } = newReply

    const deliveryDate = new Date(newReply.createdAt)
    const deliveryDateAsISOString = deliveryDate.toISOString()

    // if (!plainTextContent) {
    //   plainTextContent = ''
    // }

    /**
     * The Notion API limits children passed to the create page endpoint to 100.
     * If there are more than 100 children when creating the new page, we break the children
     * up into chunks of 100, create the page with the first chunk and then append to the
     * page to add the remaining children chunks
     */
    // const [...childChunks] = chunkArr(
    //   createPlainTextBlocks(plainTextContent),
    //   100,
    // )

    let pageCreateResp

    try {
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
        // children: [
        //   {
        //     type: 'callout',
        //     callout: {
        //       rich_text: [
        //         {
        //           type: 'text',
        //           text: {
        //             content: 'Send this email',
        //             // TODO - replace with correct URL for sending once we build it
        //             link: { url: `${FRONTEND_BASE_URL}/email/reply/create-notion-page/${originalEmailUUID}/${}` },
        //           },
        //         },
        //       ],
        //       icon: {
        //         emoji: '▶️',
        //       },
        //       color: 'default',
        //     },
        //   },
        // ],
      }

      pageCreateResp = await notionClient.pages.create(createEmailPagePayload)

      const { status, url, id: notionPageID } = pageCreateResp

      console.log('pageCreateResp', pageCreateResp)

      if (status === 429) {
        console.warn(
          `user with id ${userfrontID} is hitting notion api rate limits during page creation`,
        )
        return null
      }

      if (status === 404) {
        console.warn(
          `notion database with id ${notionDatabaseId} could not be found`,
        )
        return null
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
                    link: { url: `${FRONTEND_BASE_URL}/email/reply/send/${originalEmailUUID}/${pageId}` },
                  },
                },
              ],
              icon: {
                emoji: '▶️',
              },
              color: 'default',
            },
          },
        ]

      })
      /**
       * Append any existing child chunks to a Notion page.
       * We await the append call in each loop iteration so that
       * we know that the chilren are added in the correct order.
       */
      // for (let childChunk of childChunks) {
      //   await notionClient.blocks.children.append({
      //     block_id: pageId,
      //     children: [...childChunk],
      //   })
      // }

      return { pageId, notionEmailDatabaseId: notionDatabaseId, notionPageUrl: url }
    } catch (err) {
      console.error('error adding page to notion', err)
    }

    return null
  } catch (err) {
    console.log(err)
    return null
  }
}

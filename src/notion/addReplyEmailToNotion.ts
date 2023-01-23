import { Client } from '@notionhq/client'
import type {
  GetDatabaseResponse,
  GetPageResponse,
} from '@notionhq/client/build/src/api-endpoints'
import type {
  UpdateDatabaseParameters,
  CreatePageParameters,
} from '@notionhq/client/build/src/api-endpoints'
import 'dotenv/config'
import { db } from '../db-connection'
import type { NotionIntegration } from '../types/database'
import { EmailAttachment, NotionDatabaseType } from '../types/database'
import { convertHTMLToNotionBlocks } from './html-parser'
import { createAttachmentBlocks } from './createAttachmentBlocks'
import { createPlainTextBlocks } from './createPlainTextBlocks'
import { chunkArr, getEmailFromEmailToStr } from '../utils'
import { getNotionClient } from './getNotionClient'
import { getNotionDatabaseId, NewEmail } from './notion';

export async function addReplyEmailToNotion({
   newEmail,
   userfrontID,
   originalEmailPageId,
   notionClient,
 }: {
   newEmail: NewEmail
   userfrontID: string
   originalEmailPageId,
   notionClient: Client
 }): Promise<{ pageId: string; notionEmailDatabaseId: string } | null> {

   const notionDatabaseId = await getNotionDatabaseId(
     userfrontID,
     NotionDatabaseType.EMAIL,
   );

   const requiredProps = ['To', 'From', 'InReplyTo', 'Delivered', 'UUID'];

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

   const { subject, from } = newEmail
   let { plainTextContent } = newEmail

   const deliveryDate = new Date(newEmail.createdAt)
   const deliveryDateAsISOString = deliveryDate.toISOString()

   if (!plainTextContent) {
     plainTextContent = ''
   }

   /**
    * The Notion API limits children passed to the create page endpoint to 100.
    * If there are more than 100 children when creating the new page, we break the children
    * up into chunks of 100, create the page with the first chunk and then append to the
    * page to add the remaining children chunks
    */
   const [firstChildChunk, ...childChunks] = chunkArr(createPlainTextBlocks(plainTextContent), 100)

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
         From: {
           email: getEmailFromEmailToStr(from) || '',
         },
         Delivered: {
           date: {
             start: deliveryDateAsISOString,
           },
         },
         UUID: {
           rich_text: [
             {
               type: 'text',
               text: {
                 content: newEmail.uuid,
               }
             }
           ]
         },
       },
       children: [...firstChildChunk],
     }

     pageCreateResp = await notionClient.pages.create(createEmailPagePayload)

     const { status } = pageCreateResp

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

     /**
      * Append any existing child chunks to a Notion page.
      * We await the append call in each loop iteration so that
      * we know that the chilren are added in the correct order.
      */
     for (let childChunk of childChunks) {
       await notionClient.blocks.children.append({
         block_id: pageId,
         children: [...childChunk],
       })
     }

     return { pageId, notionEmailDatabaseId: notionDatabaseId }
   } catch (err) {
     console.error('error adding page to notion', err)
   }

   return null
 }

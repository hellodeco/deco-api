import { Request, Response } from 'express'
import { isArray } from 'lodash'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db-connection'
import { EmailStatus, S3_BUCKET } from '../constants'
import { addEmailToNotion, notionClient } from '../notion/notion'
import { objectCamelToSnake } from '../utils'
import type { MulterFile } from '../types/shared'
import type {
  EmailAttachment,
  Subscription,
  NotionDatabase,
  NotionIntegration,
} from '../types/database'
import s3Client from '../s3-client'

interface InboundSendgridParsedEmail {
  userId?: string
  subject: string
  plainTextContent: string
  from: string
  emailId?: number
  emailThreadId?: number
  htmlContent?: string
  status?: string
  notionPageId?: string
  messageId?: string
  inReplyTo?: string
  references?: string
}

export interface Header {
  key: string
  value: string
  emailId: number
}

type HeaderMap = Record<string, Array<string>>

const FREE_TIER_EMAIL_LIMIT = 100

// parses a string into a map of header names to arrays of values since each header can have multiple values
export function parseHeaderString(headers: string): HeaderMap {
  const headersArray = headers.split(/\n/)

  const headerMap = {}

  headersArray.forEach((header) => {
    if (header.indexOf(':') < 0) {
      return
    }

    let [key, val] = header.split(': ')

    if (!key || !val) {
      return
    }

    key = key.toLowerCase()

    if (!headerMap[key]) {
      headerMap[key] = []
    }

    headerMap[key].push(val)
  })

  return headerMap
}

export function headerMapToArray(
  headerMap: HeaderMap,
  emailId: number,
): Array<Header> {
  return Object.entries(headerMap).reduce((acc, [key, values]) => {
    values.forEach((value) => {
      acc.push({
        key,
        value,
        emailId,
      })
    })

    return acc
  }, [] as Array<Header>)
}

async function storeFiles(files: Array<MulterFile>) {
  const promises = files.map(async (file) => {
    // Example fields on the file object:
    // fieldname: 'attachment1',
    // originalname: 'salute.png',
    // encoding: '7bit',
    // mimetype: 'image/png'
    // size: number

    const uuid: string = uuidv4()
    const key = `${uuid}-${file.originalname}`

    try {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: key,
          Body: file.buffer,
          Metadata: {
            // TODO: should we store file metadata along with the file here?
          },
        }),
      )

      return {
        ...file,
        uuid,
      }
    } catch (err) {
      console.error(`error uploading attachment ${key} to storage bucket`, err)
    }

    return null
  })

  // TODO: do something with files that failed to upload rather than just ignore them
  return (await Promise.all(promises)).filter(Boolean)
}

export async function emailReceiveHandler(req: Request, res: Response) {
  const { body } = req
  const { headers, from, subject, text, html, envelope: envelopeStr } = body

  // req.body contains:
  // - headers
  // - dkim
  // - to -> sometimes "to" can be formatted like this: "to": "Matt Ehlinger <ehlinger.matt@gmail.com>"
  // - cc
  // - html
  // - from
  // - text
  // - sender_ip
  // - spam_report
  // - envelope
  // - attachments
  // - subject
  // - spam_score
  // - charsets
  // - SP

  // @ts-ignore
  const files = await storeFiles(req.files as Array<MulterFile>)

  const headersMap = parseHeaderString(headers)

  const inReplyTo = headersMap['in-reply-to']
  const references = headersMap['references']
  const messageID = headersMap['message-id']

  let envelope = { to: [] }
  try {
    envelope = JSON.parse(envelopeStr)
  } catch (err) {
    console.error('error parsing incoming email envelope JSON', err)
  }

  let toAddresses = envelope?.to || []
  if (!isArray(toAddresses)) {
    toAddresses = [toAddresses]
  }

  for (let to of toAddresses) {
    to = to.toLowerCase()
    let emailRecipient

    try {
      emailRecipient = await db
        .users()
        .where('email_address', to)
        .select('*')
        .first()
    } catch (err) {
      console.error('error querying for email recipient', err)
    }

    const incomingEmail: InboundSendgridParsedEmail = {
      subject,
      from,
      plainTextContent: text,
      htmlContent: html,
    }

    if (references) {
      incomingEmail.references = references[0]
    }

    if (inReplyTo) {
      incomingEmail.references = inReplyTo[0]
    }

    if (messageID) {
      incomingEmail.messageId = messageID[0]
    }

    if (!emailRecipient) {
      /**
       * @todo persist the "to" address for these
       */

      incomingEmail.status = EmailStatus.TO_ADDRESS_NOT_FOUND

      try {
        await db
          .emails()
          .returning('*')
          .insert(objectCamelToSnake(incomingEmail))
      } catch (err) {
        console.error('error inserting email', err)
      }

      continue
    }

    incomingEmail.userId = emailRecipient.id
    incomingEmail.status = EmailStatus.RECEIVED_TO_DECO

    // TODO: compose threads rather than creating a new one for each new email
    let newEmailThread

    try {
      const [thread] = await db.emailThreads().returning('*').insert({
        subject,
        user_id: emailRecipient.id,
      })

      newEmailThread = thread
    } catch (err) {
      console.error(err)
    }

    incomingEmail.emailThreadId = newEmailThread?.id

    let newEmail
    try {
      const [email] = await db
        .emails()
        .insert(objectCamelToSnake(incomingEmail))
        .returning('*')

      newEmail = email
      incomingEmail.emailId = email.id
    } catch (err) {
      console.error(err)
    }

    const preppedFiles: Array<EmailAttachment> = files.map((file) => {
      return {
        userfrontUserId: emailRecipient.userfrontUserId,
        uuid: file.uuid,
        filename: file.originalname,
        encoding: file.encoding,
        mimetype: file.mimetype,
        size: file.size,
        emailId: newEmail.id,
      }
    })
    try {
      // passing an empty array here causes the insert to fail
      if (preppedFiles.length > 0) {
        await db.emailAttachments().insert(preppedFiles.map(objectCamelToSnake))
      }
    } catch (err) {
      console.error('error inserting email attachments', err)
    }

    let subscription: Subscription
    try {
      // multiple subscriptions can sometimes exist for one user so we need
      // to check all of them here
      subscription = await db
        .subscriptions()
        .where({
          userfront_user_id: emailRecipient.userfrontUserId,
          subscription_status: 'active',
        })
        .select('subscription_status')
        .first()
    } catch (err) {
      console.error('error querying for subscription', err)
    }

    // We will deliver email to notion under the following conditions:
    // 1. user has a subscription with a status of "active"
    // 2. user has no subscription OR active subscription AND has a notion_integration AND notion_database AND less than FREE_TIER_EMAIL_LIMIT emails in their connection Notion database
    let shouldDelieverToNotion = Boolean(subscription)

    let notionIntegration: Pick<NotionIntegration, 'id' | 'accessToken'>
    if (!subscription) {
      try {
        notionIntegration = await db
          .notionIntegrations()
          .where('userfront_user_id', emailRecipient.userfrontUserId)
          .select('id', 'access_token')
          .first()
      } catch (err) {
        console.error(err)
      }
    }

    let notionDatabase: Pick<NotionDatabase, 'notionDatabaseId'>
    if (!subscription && notionIntegration) {
      try {
        notionDatabase = await db
          .notionDatabases()
          .where('notion_integration_id', notionIntegration.id)
          .select('notion_database_id')
          .first()
      } catch (err) {
        console.error(err)
      }
    }

    if (!subscription && notionDatabase) {
      const { notionDatabaseId } = notionDatabase

      // this is a fast and messy way to get the count of rows in the notion database inbox
      const notion = await notionClient(emailRecipient.userfrontUserId)

      // this is an array of objects where each object represents a row in the email inbox database
      const { results: notionRowData } = await notion.databases.query({
        database_id: notionDatabaseId,
        // limit to one greater than the email limit so to avoid overfetching
        page_size: FREE_TIER_EMAIL_LIMIT + 1,
      })

      shouldDelieverToNotion = notionRowData.length < FREE_TIER_EMAIL_LIMIT
    }

    let emailStatus = EmailStatus.RECEIVED_TO_DECO
    let notionPageId = null

    if (shouldDelieverToNotion) {
      try {
        const { pageId } = await addEmailToNotion({
          newEmail: incomingEmail,
          userfrontID: emailRecipient.userfrontUserId,
          attachments: preppedFiles,
        })

        emailStatus = EmailStatus.RECEIVED_TO_NOTION
        notionPageId = pageId
      } catch (err) {
        console.error(err)
      }
    } else {
      console.warn(
        `warn: email not delivered to Notion because ${toAddresses} does not have an active subscription or has exceeded their free tier limit of ${FREE_TIER_EMAIL_LIMIT} emails in their inbox`,
      )
    }

    try {
      await db
        .emails()
        .where('id', newEmail.id)
        .update(
          objectCamelToSnake({
            status: emailStatus,
            notionPageId,
          }),
        )
    } catch (err) {
      console.error('error updating email status', err)
    }

    try {
      await db
        .emailHeaders()
        .insert(
          headerMapToArray(headersMap, newEmail.id).map((header) =>
            objectCamelToSnake(header),
          ),
        )
    } catch (err) {
      console.error('error inserting email headers', err)
    }
  }

  // sendgrid requires a 200 response regardless of success or failure or else it will continually retry
  // thus, we need to signal to sendgrid that we got the email and do not require an additional retry
  res.status(200).json({ message: 'success' })
}

import { Request, Response } from 'express'
import { isArray } from 'lodash'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db-connection'
import { EmailStatus } from '../constants'
import { addEmailToNotion } from '../notion/notion'
import { objectCamelToSnake } from '../utils'
import type { MulterFile } from '../types/shared'
import type { EmailAttachment } from '../types/database'
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

    try {
      let uuid: string = uuidv4()

      await s3Client.send(
        new PutObjectCommand({
          Bucket: 'attachments',
          Key: `${uuid}-${file.originalname}`,
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
      console.error(err)
    }

    return null
  })

  // TODO: do something with files that failed to upload rather than just ignore them
  return (await Promise.all(promises)).filter(Boolean)
}

export async function emailReceiveHandler(req: Request, res: Response) {
  const { body } = req
  const { headers, from, subject, text, html, cc, envelope: envelopeStr } = body
  // TODO: we need this data when streaming files to s3 instead of buffering them in memory first (like we do now)
  // const attachmentInfo = body['attachment-info']

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
    console.error(err)
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
      console.error(err)
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
        console.error(err)
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
        .returning('*')
        .insert(objectCamelToSnake(incomingEmail))

      newEmail = email
    } catch (err) {
      console.error(err)
    }

    incomingEmail.emailId = newEmail?.id

    try {
      const preppedFiles: Array<EmailAttachment> = files
        .map((file) => {
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

      await db.emailAttachments().insert(preppedFiles.map(objectCamelToSnake))

      const { id, ...rest } = await addEmailToNotion({
        newEmail: incomingEmail,
        userfrontID: emailRecipient.userfrontUserId,
        attachments: preppedFiles,
      })

      await db
        .emails()
        .where('id', newEmail.id)
        .update(
          objectCamelToSnake({
            status: EmailStatus.RECEIVED_TO_NOTION,
            notionPageId: id,
          }),
        )

      await db
        .emailHeaders()
        .insert(
          headerMapToArray(headersMap, newEmail.id).map((header) =>
            objectCamelToSnake(header),
          ),
        )
    } catch (err) {
      console.error(err)
    }
  }

  // sendgrid requires a 200 response regardless of success or failure or else it will continually retry
  // thus, we need to signal to sendgrid that we got the email and do not require an additional retry
  res.status(200).json({ message: 'success' })
}

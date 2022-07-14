import { Request, Response } from 'express'
import {
  getUserByDecoEmail,
  createNewEmailThreadByUserID,
  createNewEmail,
} from '../db-access/db-access'
import { db } from '../db-connection'
import { EmailStatus } from '../constants'
import { addEmailToNotion } from '../notion/notion'
import { objectCamelToSnake } from '../utils'

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

export async function emailReceiveHandler(req: Request, res: Response) {
  const { body } = req
  const { headers, from, subject, text } = body
  let { to } = body
  to = to.toLowerCase()

  // TODO: messages that are forwarded from another email seem to retain the same "to" address on the body object
  // this is problematic because we try and look up the original receiver in our DB which probably doesn't exist
  // since it's likely not a deco email address. We'll need to figure out what emails like this look like and then
  // handle them correctly

  const headersMap = parseHeaderString(headers)

  const inReplyTo = headersMap['in-reply-to']
  const references = headersMap['references']
  const messageID = headersMap['message-id']

  let emailRecipient

  try {
    emailRecipient = await getUserByDecoEmail(to)
  } catch (err) {
    console.error(err)
  }

  if (!emailRecipient) {
    /**
     * @todo persist the "to" address for these
     */
    const orphanedEmail: InboundSendgridParsedEmail = {
      subject: subject,
      plainTextContent: text,
      from: from,
      status: EmailStatus.TO_ADDRESS_NOT_FOUND,
    }

    if (references) {
      orphanedEmail.references = references[0]
    }

    if (inReplyTo) {
      orphanedEmail.references = inReplyTo[0]
    }

    if (messageID) {
      orphanedEmail.messageId = messageID[0]
    }

    try {
      await createNewEmail(orphanedEmail)
    } catch (err) {
      console.error(err)
    }

    return res.status(200).json({ message: 'no email recipient found' })
  }

  const newInboundEmail: InboundSendgridParsedEmail = {
    subject: subject,
    plainTextContent: text,
    from: from,
    userId: emailRecipient.id,
    status: EmailStatus.RECEIVED_TO_DECO,
  }

  if (references) {
    newInboundEmail.references = references[0]
  }

  if (inReplyTo) {
    newInboundEmail.references = inReplyTo[0]
  }

  if (messageID) {
    newInboundEmail.messageId = messageID[0]
  }

  let newEmailThread

  try {
    const [thread] = await createNewEmailThreadByUserID(
      subject,
      emailRecipient.id,
    )

    newEmailThread = thread
  } catch (err) {
    console.error(err)
  }

  newInboundEmail.emailThreadId = newEmailThread?.id

  let newEmail
  try {
    const [email] = await createNewEmail(newInboundEmail)
    newEmail = email
  } catch (err) {
    console.error(err)
  }

  newInboundEmail.emailId = newEmail?.id

  try {
    const { id } = await addEmailToNotion({
      newEmail: newInboundEmail,
      userfrontID: emailRecipient.userfrontUserId,
    })

    await db
      .emails()
      .where('id', newEmail.id)
      .update({ status: EmailStatus.RECEIVED_TO_NOTION, notionPageId: id })
  } catch (err) {
    console.error(err)
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
    console.error(err)
  }

  // sendgrid requires a 200 response regardless of success or failure
  res.status(200).json({ message: 'success' })
}

import { Request, Response } from 'express'
import { isArray } from 'lodash'
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

function logger(...args) {
  console.log(
    ...args.map(arg => {
      if (typeof arg === 'object') {
        return JSON.stringify(arg, null, 2)
      }

      return arg
    })
  )
}

async function handleEmail() {

}

export async function emailReceiveHandler(req: Request, res: Response) {
  const { body } = req
  const { headers, from, subject, text, html, cc, envelope: envelopeStr } = body


  // req.body contains:
  // 
  // - headers
  // - dkim
  // - to
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


  // TODO: messages that are forwarded from another email seem to retain the same "to" address on the body object
  // this is problematic because we try and look up the original receiver in our DB which probably doesn't exist
  // since it's likely not a deco email address. We'll need to figure out what emails like this look like and then
  // handle them correctly

  const headersMap = parseHeaderString(headers)

  // TODO: sometimes "to" can be formatted like this: "to": "Matt Ehlinger <ehlinger.matt@gmail.com>"

  logger('body keys', Object.keys(body))
  logger('headers -------------')
  logger(headersMap)
  logger('body ----------------')
  logger(body)


  const inReplyTo = headersMap['in-reply-to']
  const references = headersMap['references']
  const messageID = headersMap['message-id']

  let envelope = { to: [] }
  try {
    envelope = JSON.parse(envelopeStr)
  } catch (err) {
    console.error(err)
  }

  logger('envelope', envelopeStr)

  let toAddresses = envelope?.to || []
  if (!isArray(toAddresses)){
    toAddresses = [toAddresses]
  }

  logger('to addresses', toAddresses)

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

    console.log('email recipient', emailRecipient)


    if (!emailRecipient) {
      /**
       * @todo persist the "to" address for these
       */

      incomingEmail.status = EmailStatus.TO_ADDRESS_NOT_FOUND

      try {
        await createNewEmail(incomingEmail)
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
      const [thread] = await db
        .emailThreads()
        .returning('*')
        .insert({
          subject,
          user_id: emailRecipient.id,
        })

      logger('new thread', thread)

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

      logger('new email', email)

      newEmail = email
    } catch (err) {
      console.error(err)
    }

    incomingEmail.emailId = newEmail?.id

    try {
      console.log('adding email to notion')
      const { id, ...rest } = await addEmailToNotion({
        newEmail: incomingEmail,
        userfrontID: emailRecipient.userfrontUserId,
      })

      logger('added email to notion', id, rest)

      await db
        .emails()
        .where('id', newEmail.id)
        .update(objectCamelToSnake({ status: EmailStatus.RECEIVED_TO_NOTION, notionPageId: id }))

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

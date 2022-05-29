import express, { Request, Response } from 'express'
import dotenv from 'dotenv'
import fetch from 'node-fetch'
import {
  getUserMetaByDecoEmail,
  getEmailByMessageID,
  getEmailThreadByID,
  createNewEmailThreadByUserID,
  getEmailThreadBySubject,
  createNewEmailByUserID,
  createUserMeta,
  createOrUpdateSubscription,
} from '../db-access/db-access'
import { addEmailToNotion } from '../notion-access/notion-access'
import Userfront from '@userfront/core'

interface InboundSendgridParsedEmail {
  userId: string
  subject:          string
  plainTextContent: string
  from:             string
  emailId?: number
  emailThreadId?: number
  htmlContent?:      string
  status?:     string
  notionPageId?: string
  messageId?: string
  inReplyTo?: string
  references?: string
}

interface Header {
  key: string
  value: string
  emailId: number
}

type HeaderMap = Record<string, Array<string>>

export function parseHeaderString(headers: string): HeaderMap {
  const headersArray = headers.split(/\n/);

  const headerMap = {};

  headersArray.forEach((header) => {
    if (header.indexOf(':') < 0) {
      return
    }

    const [key, val] = header.split(': ')

    if (!key || !val) {
      return
    }

    if (!headerMap[key]) {
      headerMap[key] = []
    }

    headerMap[key].push(val)
  })

  return headerMap;
}

export function headerMapToArray(headerMap: HeaderMap, emailId: number): Array<Header> {
  return Object.entries(headerMap).reduce((acc, [key, values]) => {
    values.forEach(value => {
      acc.push({
        key,
        value,
        emailId
      })
    })

    return acc
  }, [] as Array<Header>)
}

export async function emailReceiveHandler(req: Request, res: Response) {
  try {
  const { body } = req;
  const { headers, to, from, subject, text } = body;

  const emailRecipient = await getUserMetaByDecoEmail(to);

  console.log('emailRecipient: ', emailRecipient);

  if (!emailRecipient) {
    console.log('No user found for email');
    return res.status(200).json({message: 'no email recipient found'});
  }

  const headersMap = parseHeaderString(headers);
 
  const inReplyTo = headersMap['In-Reply-To'];
  const references = headersMap['References'];
  const messageID = headersMap['Message-ID'];

  const newInboundEmail: InboundSendgridParsedEmail = {
    subject: subject,
    plainTextContent: text,
    from: from,
    userId: emailRecipient.id
  }

  if (references) {
    newInboundEmail.references = references[0];
  }

  if (messageID) {
    newInboundEmail.messageId = messageID[0];
    if (inReplyTo) {
      newInboundEmail.inReplyTo = inReplyTo[0];
      const originalEmail = await getEmailByMessageID(inReplyTo[0]);
      const emailThread = await getEmailThreadByID(originalEmail.emailThreadId);

      if (emailThread.userId === emailRecipient.id) {
        newInboundEmail.emailThreadId = emailThread.id;
      }
    } else {
      const [newEmailThread] = await createNewEmailThreadByUserID(subject, emailRecipient.id);
      newInboundEmail.emailThreadId = newEmailThread.id;
    }
  }

  const [newEmail] = await createNewEmailByUserID(newInboundEmail)

  newInboundEmail.emailId = newEmail.id;

  await addEmailToNotion({ newEmail: newInboundEmail, userfrontID: emailRecipient.userfrontUserId})
  // updateEmailWithNotionPageID and status success
  
  //



  // if okMessageID {
  //   // if we have an In Reply To header
  //   newInboundEmail.MessageID = messageIDValue[0]
  //   if okInReplyTo {
  //     newInboundEmail.InReplyTo = inReplyToValue[0]
  //     originalEmail := args.dbAccess.GetEmailByMessageID(inReplyToValue[0])
  //     // TODO if email thread can't be found by Message ID, use References to look up by other message IDs.
  //     emailThread := args.dbAccess.GetEmailThreadByID(originalEmail.EmailThreadID)

  //     // if we can't lookup thread by In Reply To message id, then create a new thread
  //     if emailThread.UserMetaID == toAddressUser.ID {
  //       newInboundEmail.EmailThreadID = emailThread.ID
  //     } else {
  //       newEmailThread := &models.EmailThread{Subject: subject, UserMetaID: toAddressUser.ID}
  //       args.dbAccess.DB.Create(newEmailThread)
  //       newInboundEmail.EmailThreadID = newEmailThread.ID
  //     }
  //   } else {
  //     // if no In Reply To header, create new thread
  //     newEmailThread := &models.EmailThread{Subject: subject, UserMetaID: toAddressUser.ID}
  //     args.dbAccess.DB.Create(newEmailThread)
  //     newInboundEmail.EmailThreadID = newEmailThread.ID
  //   }
  // } else {
  //   // if no Message ID, then try to get email thread by Subject
  //   emailThread := args.dbAccess.GetEmailThreadBySubject(subject)

  //   if emailThread.UserMetaID == toAddressUser.ID {
  //     newInboundEmail.EmailThreadID = emailThread.ID
  //   } else {
  //     newEmailThread := &models.EmailThread{Subject: subject, UserMetaID: toAddressUser.ID}
  //     args.dbAccess.DB.Create(newEmailThread)
  //     newInboundEmail.EmailThreadID = newEmailThread.ID
  //   }
  // }



  res.status(200).json({message: 'success'});
} catch(err) {
  console.log(err);
  // sendgrid requires a 200 response regardless of success or failure
  res.status(200).json({message: 'failed'});
}
}
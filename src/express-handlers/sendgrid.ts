import express, { Request, Response } from 'express'
import dotenv from 'dotenv'
import fetch from 'node-fetch'
import {
  getUserMetaByDecoEmail,
  getEmailByMessageID,
  getEmailThreadByID,
  createUserMeta,
  createOrUpdateSubscription,
} from '../db-access/db-access'
import Userfront from '@userfront/core'

interface InboundSendgridParsedEmail {
	Subject:          string,
	PlainTextContent: string
	From:             string
  UserMetaID: string
	HTMLContent?:      string
	/**
	   * TODO: represent and enforce this on the DB side  by making this an enum
		 * Status can be one of
	   * - DELIVERED
		 * - FAILED
	*/
	Status?:     string
	MessageID?:     string
	InReplyTo?:     string
	References?:    string
	EmailThreadID?: string
	// EmailThread:   EmailThread
	NotionPageID?: string
}

const parseHeaderString = (headers: string) => {
  const headersArray = headers.split(/\n/);
  const parsedHeaders = {};

  headersArray.forEach((header) => {
    if (header.indexOf(':')) {
      const headerKey = header.slice(0, header.indexOf(':'));
      const headerValue = header.slice(header.indexOf(':') + 1).trim();
      parsedHeaders[headerKey] = headerValue;
    }
  })

  return parsedHeaders;
}

export const createEmailReceiveHandler = async (req: Request, res: Response) => {
  const { body } = req;
  const { headers, to, from, subject, text } = body;

  const emailRecipient = await getUserMetaByDecoEmail(to);

  console.log('emailRecipient: ', emailRecipient);

  if (!emailRecipient) {
    console.log('No user found for email');
    return res.status(200).json({message: 'no email recipient found'});
  }

  const headersArray = parseHeaderString(headers);
  
  const inReplyTo = headersArray['In-Reply-To'];
  const references = headersArray['References'];
  const messageID = headersArray['Message-ID'];

  const newInboundEmail: InboundSendgridParsedEmail = {
    Subject: subject,
    PlainTextContent: text,
    From: from,
    UserMetaID: emailRecipient.id
  }

  if (references) {
    newInboundEmail.References = references;
  }

  if (messageID) {
    newInboundEmail.MessageID = messageID;
    if (inReplyTo) {
      newInboundEmail.InReplyTo = inReplyTo;
      const originalEmail = await getEmailByMessageID(inReplyTo);
      console.log(originalEmail);
      const emailThread = await getEmailThreadByID(originalEmail.email_thread_id);
      console.log(emailThread);

      if (emailThread.userId === emailRecipient.id) {
        newInboundEmail.EmailThreadID = emailThread.id;
      }
    }
  }

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
}
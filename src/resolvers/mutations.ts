import { isArray } from 'lodash'
import Userfront, { user } from '@userfront/core'
import sendgrid from '@sendgrid/mail'
import { GraphQLError } from 'graphql'
import { EMAIL_DOMAIN, SENDGRID_API_KEY } from '../constants'
import {
  MutationResolvers,
  UpdateDecoEmailErrorReasons,
} from '../generated/resolvers-types'
import { createUser, getUserBySignupEmail } from './../db-access/db-access'
import { reservedUsernames } from '../reservedUsernames'
import { ResolverContext } from '../types/shared'
import { NotionDatabaseType, DecoDBEmail, EmailStatus } from '../types/database'
import { objectCamelToSnake } from '../utils'
import { addReplyEmailToNotion } from '../notion/addReplyEmailToNotion'
import { getNotionClient } from '../notion/getNotionClient'
import { getNotionPageContent } from '../notion/getNotionPageContent'

sendgrid.setApiKey(SENDGRID_API_KEY)

export const mutationResolvers: MutationResolvers<ResolverContext> = {
  wipeNotionDatabase: async (_, args, { notionAccess, user }) => {
    const archivedIDs = await notionAccess.wipeNotionDatabase(user.userfrontID)
    return archivedIDs
  },
  deleteNotionTableProperties: async (_, args, { notionAccess, user }) => {
    const deletedProperties = await notionAccess.deleteNotionTableProperties(
      user.userfrontID,
    )
    return deletedProperties
  },
  formatNotionTable: async (_, args, { notionAccess, user }) => {
    const formattedTable = await notionAccess.formatNotionTable(
      user.userfrontID,
    )
    return formattedTable
  },

  createUserfrontAndDecoUser: async (_, { email, password }) => {
    const existingUser = await getUserBySignupEmail(email)

    const response = {
      success: false,
      errorMessage: null,
    }

    if (existingUser) {
      response.errorMessage =
        "Looks like you've already created a user with that email"
      return response
    }

    // add userfront user
    const signupResp = await Userfront.signup({
      method: 'password',
      email,
      password,
    })

    const createdUserUUID = signupResp.userUuid

    // todo: We should handle this case better
    // sometimes this is undefined and then crashes the server because our subscription table does not accept a null
    // value for userfront_user_id.
    if (!createdUserUUID) {
      response.errorMessage =
        'Uh Oh! We ran into an issue creating your user. Please try again'
      return response
    }

    await createUser({
      userfrontUserId: createdUserUUID,
      signupEmail: email,
    })

    response.success = true

    return response
  },

  setDecoEmail: async (
    _,
    { username: unNormalizedUsername },
    { dbAccess, db, user: { userfrontID } },
  ) => {
    const user = await dbAccess.getUserByUserfrontID(userfrontID)
    const username = unNormalizedUsername.toLowerCase()
    if (user?.emailAddress) {
      return {
        success: false,
        errorReason: UpdateDecoEmailErrorReasons.CannotChangeEmail,
      }
    }

    const emailAddress = `${username}@${EMAIL_DOMAIN}`

    const existingUser = await dbAccess.getUserByDecoEmail(emailAddress)

    if (reservedUsernames.has(username) || existingUser) {
      return {
        success: false,
        errorReason: UpdateDecoEmailErrorReasons.AlreadyTaken,
      }
    }

    if (username.length < 3) {
      return {
        success: false,
        errorReason: UpdateDecoEmailErrorReasons.NotEnoughChars,
      }
    }

    /**
     * @reference for valid email username format: https://stackoverflow.com/a/2049510
     */
    const validEmailUsername = /^\w+([\.-]?\w+)*$/

    if (!validEmailUsername.test(username)) {
      return {
        success: false,
        errorReason: UpdateDecoEmailErrorReasons.InvalidFormat,
      }
    }

    await dbAccess.updateUsersDecoEmailAddress(userfrontID, emailAddress)

    return {
      success: true,
      errorReason: null,
    }
  },
  selectNotionDatabase: async (
    _,
    { databaseId, type = 'EMAIL' },
    { db, user: { userfrontID } },
  ) => {
    try {
      /**
       * Constraints of the notion_databases table (this mutation should enforce these):
       *
       * 1. only two rows allowed per unique notion_integration_id, one with type "EMAIL" and one with type "CONTACTS"
       */

      // TODO: validate that databaseId is good to go
      const integration = await db
        .notionIntegrations()
        .where('userfront_user_id', userfrontID)
        .select('id')
        .first()

      if (!integration) {
        // TODO: do something better
        console.log(
          'no integration found for user with userfront ID: ',
          userfrontID,
        )
        return false
      }

      const existingDatabases = await db
        .notionDatabases()
        .where('notion_integration_id', integration.id)
        .select('id', 'type', 'notion_database_id')

      const emailDatabase = existingDatabases.find(
        (db) => db.type === NotionDatabaseType.EMAIL,
      )
      const contactsDatabase = existingDatabases.find(
        (db) => db.type === NotionDatabaseType.CONTACTS,
      )

      const existingDatabase =
        type === NotionDatabaseType.EMAIL ? emailDatabase : contactsDatabase

      /**
       * determine if this integration already has a notion_database with notion_database_id === databaseId
       * set as another type.
       *
       * for example: if this is attempting to set an "EMAIL" database, check if the user's
       * integration already has this database set as a "CONTACTS" database.
       * if it does, then we want to abort the operation
       */
      let databaseIsUsedByOtherType = false
      switch (type) {
        case NotionDatabaseType.EMAIL: {
          if (contactsDatabase?.notionDatabaseId === databaseId) {
            databaseIsUsedByOtherType = true
          }

          break
        }
        case NotionDatabaseType.CONTACTS: {
          if (emailDatabase?.notionDatabaseId === databaseId) {
            databaseIsUsedByOtherType = true
          }

          break
        }
      }

      if (databaseIsUsedByOtherType) {
        console.error(
          `Database ${databaseId} is already set as a ${
            type === NotionDatabaseType.EMAIL ? 'CONTACTS' : 'EMAIL'
          } database for notion_integation: ${integration.id}`,
        )
        return false
      }

      let database
      if (existingDatabase) {
        database = await db
          .notionDatabases()
          .where('notion_integration_id', integration.id)
          .andWhere('type', type)
          .update(objectCamelToSnake({ notionDatabaseId: databaseId }))
          .returning('id')
      } else {
        database = await db
          .notionDatabases()
          .insert(
            objectCamelToSnake({
              notionDatabaseId: databaseId,
              notionIntegrationId: integration.id,
              type,
            }),
          )
          .returning('id')
      }

      if (isArray(database)) {
        database = database[0]
      }

      if (!database) {
        // TODO: do something better
        console.error('No notion database created')
        return false
      }

      return true
    } catch (err) {
      console.error(err)
      return false
    }
  },

  createEmailReplyPage: async (
    _,
    { originalEmailUUID },
    { user: { userfrontID }, db },
  ) => {
    const notionClient = await getNotionClient(userfrontID)

    const user = await db
      .users()
      .where('userfront_user_id', userfrontID)
      .select('*')
      .first()

    const originalEmail = await db
      .emails()
      .where('uuid', originalEmailUUID)
      .andWhere('user_id', user.id)
      .select('*')
      .first()

    if (!originalEmail) {
      throw new GraphQLError(
        '"Reply to" email not found. You may not have access to the email you are trying to reply to.',
      )
    }

    const replyEmail = {
      subject: `RE: ${originalEmail.subject}`,
      to: originalEmail.from,
      from: user.emailAddress,
      inReplyTo: originalEmail.notionPageId,
      emailThreadId: originalEmail.emailThreadId,
      plainTextContent: '',
      createdAt: new Date().toISOString(),
    }

    const notionEmailResp = await addReplyEmailToNotion({
      newReply: replyEmail,
      userfrontID: userfrontID,
      originalEmailUUID,
      notionClient,
    })

    return notionEmailResp
  },
  sendEmailReply: async (
    _,
    { notionPageID, originalEmailUUID },
    { db, user: { userfrontID } },
  ) => {
    /**
     * TODO 💅 polish 💅
     *  - should we append a "reply success message" the "reply button" in notion if this succeeds?
     *  - should we add a new email to our db for each "to" address?
     *  - update the email status to EmailStatus.REPLY_SENT__FAILED if something goes wrong
     */

    const notionClient = await getNotionClient(userfrontID)

    const user = await db
      .users()
      .where('userfront_user_id', userfrontID)
      .select('*')
      .first()

    const originalEmail = await db
      .emails()
      .where('uuid', originalEmailUUID)
      .andWhere('user_id', user.id)
      .select('*')
      .first()

    if (!originalEmail) {
      throw new GraphQLError(
        '"Reply to" email not found. You may not have access to the email you are trying to reply to.',
      )
    }

    const { pageMetadata, plainText } = await getNotionPageContent({
      notionClient,
      notionPageID,
    })

    // TODO we should do some form of validation that the email addresses found here are valid and formatted correctly
    // @ts-ignore
    const to = pageMetadata?.properties?.To?.email
      ?.split(',')
      .map((email) => email.trim())

    // @ts-ignore
    const subject = pageMetadata?.properties?.Name?.title
      ?.map((title) => title.plain_text)
      .join('')

    const sendGridResp = await sendgrid.send({
      to,
      subject,
      from: user.emailAddress,
      text: plainText,
      headers: {
        'In-Reply-To': originalEmail.messageId,
        References: originalEmail.messageId,
      },
    })

    // this is an array that sometimes contains empty strings for some reason
    const [sendGridData] = sendGridResp.filter(Boolean)

    const [replyEmail] = await db
      .emails()
      .insert(
        objectCamelToSnake({
          subject,
          notionPageID,
          plainTextContent: plainText,
          from: user.emailAddress,
          // TODO we do not have a "to" field currently and should add this to the email table
          // to: '',
          userId: user.id,
          // TODO add status' for sent emails/email replies (rn we only have statuses for incoming emails)
          status: EmailStatus.REPLY_SENT__SUCCEEDED,
          // @ts-ignore
          messageId: sendGridData.headers['x-message-id'],
          inReplyTo: originalEmail.messageId,
          references: originalEmail.messageId,
        }),
      )
      .returning('*')

    // TODO validate that the UUID property exists on the database
    await notionClient.pages.update({
      page_id: notionPageID,
      properties: {
        UUID: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: replyEmail.uuid,
              },
            },
          ],
        },
      },
    })

    const inbox = await notionClient.databases.retrieve({
      // @ts-ignore beacuse there is most definitely a parent on this object
      database_id: pageMetadata.parent.database_id,
    })

    // @ts-ignore beacuse there is most definitely a url on this object
    const inboxPageURL = inbox.url

    return { inboxPageURL }
  },
}

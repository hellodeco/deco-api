import { isArray } from 'lodash'
import { EMAIL_DOMAIN, FRONTEND_BASE_URL, IS_LOCAL } from '../constants'
import {
  MutationResolvers,
  UpdateDecoEmailErrorReasons,
} from '../generated/resolvers-types'
import { createUser, getUserBySignupEmail } from './../db-access/db-access'
import { reservedUsernames } from '../reservedUsernames'
import { ResolverContext } from '../types/shared'
import { NotionDatabaseType } from '../types/database'
import { objectCamelToSnake } from '../utils'
import Userfront from '@userfront/core'

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
}

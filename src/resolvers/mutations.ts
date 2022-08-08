import { isArray } from 'lodash'
import Userfront from '@userfront/core'
import sendgridClient from '@sendgrid/mail'
import { EMAIL_DOMAIN, SENDGRID_API_KEY } from '../constants'
import {
  MutationResolvers,
  UpdateDecoEmailErrorReasons,
} from '../generated/resolvers-types'
import { createUser, getUserBySignupEmail } from './../db-access/db-access'
import { reservedUsernames } from '../reservedUsernames'
import { ResolverContext } from '../types/shared'
import { User } from '../types/database'
import { objectCamelToSnake } from '../utils'

sendgridClient.setApiKey(SENDGRID_API_KEY)

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

    const subscription = await db
      .subscriptions()
      .where({
        userfront_user_id: userfrontID,
        subscription_status: 'active',
      })
      .select('*')
      .first()

    if (!subscription || subscription?.subscriptionStatus !== 'active') {
      return {
        success: false,
        errorReason: UpdateDecoEmailErrorReasons.NoSubscription,
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
    { databaseId },
    { db, user: { userfrontID } },
  ) => {
    try {
      // TODO: validate that databaseId is good to go

      const integration = await db
        .notionIntegrations()
        .where('userfront_user_id', userfrontID)
        .select('id')
        .first()

      if (!integration) {
        // TODO: do something better
        return false
      }

      const existingDatabase = await db
        .notionDatabases()
        .where('notion_integration_id', integration.id)
        .select('id')
        .first()

      let database
      if (existingDatabase) {
        database = await db
          .notionDatabases()
          .where('notion_integration_id', integration.id)
          .update(objectCamelToSnake({ notionDatabaseId: databaseId }))
          .returning('id')
      } else {
        database = await db
          .notionDatabases()
          .insert(
            objectCamelToSnake({
              notionDatabaseId: databaseId,
              notionIntegrationId: integration.id,
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
  sendMail: async (_, { email }, { db, user }) => {
    const { subject, to, cc, bcc, plainTextContent } = email
    let { attachments } = email

    if (!attachments) {
      attachments = []
    }

    let dbUser: Pick<User, 'id' | 'emailAddress' | 'fullName'>

    try {
      dbUser = await db
        .users()
        .where('userfront_user_id', user.userfrontID)
        .first()
        .select(['id', 'email_address', 'full_name'])

      console.log('dbUser', dbUser)
    } catch (err) {
      console.error(err)
    }
    
    if (!dbUser) {
      return {
        success: false,
        errorReason: 'No user found',
      }
    }

    const personalizations = [
      {
        to: [...to],
      }
    ]

    try {
      let sgRes = await sendgridClient.send({
        personalizations,
        // TODO: set up domain authentication for sendgrid
        // https://docs.sendgrid.com/ui/account-and-settings/how-to-set-up-domain-authentication
        from: {

          email: dbUser.emailAddress,
          name: dbUser.fullName,
        },
        subject,
        content: [
          {
            type: 'text/plain',
            value: plainTextContent,
          },
        ],
        // attachments,
      })
      console.log(sgRes)
    } catch (err) {
      console.error(err)
      console.log(JSON.stringify(err, null, 2))

      return {
        success: false,
        message: 'mail failed to send',
      }
    }
 
    return {
      success: true,
      message: 'success',
    }
  },
}

// mutation sendMail {
//   sendMail(email: {
//     subject: "hello there!",
//    	to: [
//       
//     	{
//         email: "ehlinger.matt@gmail.com",
//       }
//     ],
//     attachments: [],
//     plainTextContent: "dear mr. bean,\n\nhow are you this monday?\n\nwith all love,\n\njohn prine"
//     
//   }) {
//     success
//     message
//   }
// }

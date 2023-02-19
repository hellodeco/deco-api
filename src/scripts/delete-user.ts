import { db, dbConnection } from '../db-connection'

async function deleteUser() {
  const USERFRONT_ID = process.env.USERFRONT_ID 

  if (!USERFRONT_ID) {
    throw new Error('USERFRONT_ID is required')
  }

  const user = await db.users().where('userfront_user_id', USERFRONT_ID).first()

  if (!user) {
    throw new Error(`user with userfront_user_id: ${USERFRONT_ID} not found`)
  }

  await dbConnection.transaction(async (trx) => {
    // delete emails
    console.log('deleting emails from database...')
    const deletedEmails = await trx.table('emails')
      .where('user_id', user.id)
      .delete()
      .returning('id')

    // delete email headers
    console.log('deleting email headers from database...')
    await Promise.all(
      deletedEmails.map(async ({ id }) => {
        return trx.table('email_headers').where('email_id', id).delete()
      })
    )

    // delete email threads
    console.log('deleting email threads from database...')
    await trx.table('email_threads').where('user_id', user.id).delete()

    // delete attachments from the database
    console.log('deleting attachments from database...')
    const deletedAttachments = []
    await Promise.all(
      deletedEmails.map(async ({ id }) => {
        const attachments = await trx.table('email_attachments')
          .where('email_id ', id)
          .delete()
          .returning('*')

        deletedAttachments.push(...attachments)
      })
    )

    // delete attachment tokens
    console.log('deleting attachment tokens from database...')
    await Promise.all(
      deletedAttachments.map(async ({ id }) => {
        return trx.table('email_attachment_tokens')
          .where('email_attachment_id', id)
          .delete()
      })
    )

    // delete notion integrations and databases
    console.log('delete notion integrations and databases and databases...')
    await trx.table('notion_integrations')
      .where('userfront_user_id', USERFRONT_ID)
      .delete()

    // delete subscription
    console.log('deleting subscription from database...')
    await trx.table('subscriptions').where('userfront_user_id', USERFRONT_ID).delete()

    // delete user
    console.log('delete user from database...')
    await trx.table('users').where('userfront_user_id', USERFRONT_ID).delete()
  })

}


deleteUser()
  .then((res) => {
    console.log(res)
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })

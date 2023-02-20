import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import fetch from 'node-fetch'
import { db, dbConnection } from '../db-connection'
import { client as s3Client } from '../s3/s3Client'
import { S3_BUCKET } from '../constants'
import { EmailAttachment } from '../types/database'

async function deleteFiles(files: Array<EmailAttachment>) {
  await Promise.all(
    files.map(async ({ filename, uuid }) => {
      try {
        const key = `${uuid}-${filename}`
        const data = await s3Client.send(
          new DeleteObjectCommand({
            Bucket: S3_BUCKET,
            Key: key,
          })
        );
      } catch (err) {
        console.error('error deleting file object', err)
      }
    })
  )
}

async function deleteUser() {
  const USERFRONT_ID = process.env.USERFRONT_ID 
  const USERFRONT_ADMIN_API_KEY = process.env.USERFRONT_ADMIN_API_KEY

  if (!USERFRONT_ID) {
    throw new Error('USERFRONT_ID is required')
  }

  if (!USERFRONT_ADMIN_API_KEY) {
    throw new Error('USERFRONT_ADMIN_API_KEY is required')
  }

  const user = await db.users().where('userfront_user_id', USERFRONT_ID).first()

  if (!user) {
    throw new Error(`user with userfront_user_id: ${USERFRONT_ID} not found`)
  }

  const deletedAttachments = []

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

  // delete files from s3
  console.log('deleting files from s3...')
  await deleteFiles(deletedAttachments)

  console.log('delete user from userfront...')
  const userfrontResp = await fetch(`https://api.userfront.com/v0/users/${USERFRONT_ID}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${USERFRONT_ADMIN_API_KEY}`
    }
  });

  console.log(await userfrontResp.json());
}

deleteUser()
  .then((res) => {
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })

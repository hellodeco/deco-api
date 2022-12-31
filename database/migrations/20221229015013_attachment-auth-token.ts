import { Knex } from "knex";


/**
 * Add new table attachment_auth_tokens
 * 
 * This will be a "many to one" relationship with attachments 
 * 
 * The reason for the new table is twofold:
 *  1. allow attachments to have multiple auth tokens
 *  2. mitigate the risk of returning an auth token in a query for an attachment row
 *  
 * The auth tokens should be store encrypted in the database
 * 
 * Attachments can then be viewed in two ways:
 *  1. by an authenticated user who has access to the attachment
 *  2. by anyone with an attachment link that includes a valid auth token
 * 
 * The attachment can then be downloaded by hitting the '/files/attachments/:attachmentId/:filename' endpoint
 * and passing the auth token as a query param. 
 * 
 * The auth tokens should be generated and url safe base 64 endcoded like so:
 * 
 * const { promisify } = require('util')
 * const { randomBytes } = require('crypto')
 * 
 * syncRandomBytes = promisify(randomBytes)
 * 
 * async function generateToken() {
 *   const buf = await syncRandomBytes(20)
 *   return buf.toString('base64url')
 * }
 * 
 * generateToken()
 */


export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('email_attachment_tokens', (table) => {
    table.increments().primary()

    table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: false }).defaultTo(knex.fn.now())
    table.timestamp('deleted_at', { useTz: false })

    table.integer('email_attachment_id').notNullable().references('id').inTable('email_attachments').onDelete('CASCADE')
    table.string('token').notNullable().unique()
  })
}


export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('email_attachment_tokens')
}

import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('email_attachments', (table) => {
    table.increments().primary()
    table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: false }).defaultTo(knex.fn.now())
    table.timestamp('deleted_at', { useTz: false })
    table.string('uuid')
    table.string('filename')
    table.string('encoding')
    table.string('mimetype')
    table.integer('email_id')
    table.string('userfront_user_id')
  })
}


export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('email_attachments')
}


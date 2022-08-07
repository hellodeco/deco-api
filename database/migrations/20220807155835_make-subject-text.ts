import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('emails', async (table) => {
    await table.text('subject').alter()
  })

  await knex.schema.alterTable('email_threads', async (table) => {
    await table.text('subject').alter()
  })
}


export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('emails', async (table) => {
    await table.string('subject').alter()
  })

  await knex.schema.alterTable('email_threads', async (table) => {
    await table.string('subject').alter()
  })
}


import { Knex } from "knex";
import { v4 as uuidv4 } from 'uuid'


export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('emails', async (table) => {
    await table.string('uuid')
      .defaultTo(knex.raw('gen_random_uuid()'))
      .notNullable()
  })

  await knex.transaction(async (trx) => {
    const emails = await trx('emails')
      .select('id')

    const promises: Array<Promise<any>> = []

    for (let { id } of emails) {
      promises.push(
        trx('emails')
          .update({ uuid: uuidv4() })
          .where('id', id)
      )
    }

    await Promise.all(promises)
  })
}


export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('emails', async (table) => {
    await table.dropColumn('uuid')
  })
}


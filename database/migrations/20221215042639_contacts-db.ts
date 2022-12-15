import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('notion_databases', async (table) => {
    await table.string('type')
  })

  await knex.transaction(async (trx) => {
    const dbs = await trx('notion_databases')
      .select('id')

    let promises: Array<Promise<any>> = []

    for (let { id } of dbs) {
      promises.push(
        trx('notion_databases')
          .update({ type: 'EMAIL' })
          .where('id', id)
      )
    }

    await Promise.all(promises)
  })
}


export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('notion_databases', async (table) => {
    await table.dropColumn('type')
  })
}


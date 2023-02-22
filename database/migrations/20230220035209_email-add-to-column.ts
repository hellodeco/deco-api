import { Knex } from "knex";

export function chunkArr(
  arr: Array<any>,
  size: number = 100,
): Array<Array<any>> {
  let chunks: Array<any> = []

  let start = 0
  let end = size

  while (start < arr.length) {
    chunks.push(arr.slice(start, end))
    start = end
    end += size
  }

  return chunks
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('emails', (table) => {
    table.jsonb('to');
  })

  await knex.transaction(async (trx) => {
    const emails = await trx('emails')
      .where('to', null)
      .select('id')
    
    const emailChunks = chunkArr(emails, 1000)

    for (const emailChunk of emailChunks) {
      await Promise.all(
        emailChunk.map(async (email) => {
          const results = await trx('email_headers')
            .where('email_id', email.id)
            .andWhere('key', 'to')
            .select('value')

          const toAddresses = results.map((result) => result.value).filter(Boolean)

          if (toAddresses.length) {
            await trx('emails')
              .where('id', email.id)
              .update({
                to: JSON.stringify(toAddresses),
              })
          }
        })
      )
    }
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('emails', (table) => {
    table.dropColumn('to');
  })
}


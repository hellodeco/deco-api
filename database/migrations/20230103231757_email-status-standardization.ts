import { Knex } from 'knex';


export async function up(knex: Knex): Promise<void> {
  await knex('emails')
    .where('status', 'TO_ADDRESS_NOT_FOUND')
    .update({
      status: 'RECEIVED_TO_DECO__TO_ADDRESS_NOT_FOUND',
    })
}


export async function down(knex: Knex): Promise<void> {
  await knex('emails')
    .where('status', 'RECEIVED_TO_DECO__TO_ADDRESS_NOT_FOUND')
    .update({
      status: 'TO_ADDRESS_NOT_FOUND',
    })
}

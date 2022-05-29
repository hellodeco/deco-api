import { Knex } from 'knex'

enum ColType {
  String = 'string',
  Text = 'text',
  Int = 'integer',
}

interface ColumnConfig {
  name: string
  type: ColType
  unique?: boolean
  charLimit?: number
}

interface TableConfig {
  name: string
  columns: Array<ColumnConfig>
}

const TIMESTAMP_TRIGGER_NAME = 'update_timestamp'

const tableConfigs: Array<TableConfig> = [
  {
    name: 'users',
    columns: [
      {
        name: 'email_address',
        type: ColType.String,
        unique: true,
      },
      {
        name: 'signup_email',
        type: ColType.String,
        unique: true,
      },
      {
        name: 'userfront_user_id',
        type: ColType.String,
        unique: true,
      },
      {
        name: 'full_name',
        type: ColType.String,
      },
    ],
  },
  {
    name: 'notion_integrations',
    columns: [
      {
        name: 'userfront_user_id',
        type: ColType.String,
      },
      {
        name: 'access_token',
        type: ColType.String,
      },
      {
        name: 'token_type',
        type: ColType.String,
      },
      {
        name: 'workspace_id',
        type: ColType.String,
      },
      {
        name: 'workspace_name',
        type: ColType.String,
      },
      {
        name: 'workspace_icon',
        type: ColType.String,
      },
      {
        name: 'bot_id',
        type: ColType.String,
      },
      {
        name: 'user_id',
        type: ColType.String,
      },
      {
        name: 'user_full_name',
        type: ColType.String,
      },
      {
        name: 'avatar_url',
        type: ColType.String,
      },
      {
        name: 'type',
        type: ColType.String,
      },
      {
        name: 'email',
        type: ColType.String,
      },
    ],
  },
  {
    name: 'email_threads',
    columns: [
      {
        name: 'subject',
        type: ColType.String,
      },
      {
        name: 'user_id',
        type: ColType.Int,
      },
    ],
  },
  {
    name: 'emails',
    columns: [
      {
        name: 'subject',
        type: ColType.String,
      },
      {
        name: 'plain_text_content',
        type: ColType.Text,
      },
      {
        name: 'html_content',
        type: ColType.Text,
      },
      {
        name: 'from',
        type: ColType.String,
      },
      {
        name: 'status',
        type: ColType.String,
      },
      {
        name: 'user_id',
        type: ColType.Int,
      },
      {
        name: 'message_id',
        type: ColType.String,
      },
      {
        name: 'in_reply_to',
        type: ColType.String,
      },
      {
        name: 'references',
        type: ColType.String,
      },
      {
        name: 'email_thread_id',
        type: ColType.Int,
      },
      {
        name: 'email_thread',
        type: ColType.String,
      },
      {
        name: 'notion_page_id',
        type: ColType.String,
      },
    ],
  },
  {
    name: 'email_headers',
    columns: [
      {
        name: 'key',
        type: ColType.String,
      },
      {
        name: 'value',
        type: ColType.String,
        charLimit: 10000,
      },
      {
        name: 'email_id',
        type: ColType.Int,
      },
    ],
  },
]

export async function up(knex: Knex): Promise<any> {
  /**
   * Define an updater function for the created_at field and tell the postgres engine to run it
   * everytime a record is updated
   *
   * @reference https://dev.to/morz/knex-psql-updating-timestamps-like-a-pro-2fg6
   */
  await knex.raw(`
    CREATE OR REPLACE FUNCTION ${TIMESTAMP_TRIGGER_NAME}() RETURNS TRIGGER
    LANGUAGE plpgsql
    AS
    $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$;
  `)

  /**
   * Add each table, their associated columns and ad PG timestamp trigger function
   */
  const promises = tableConfigs.map(async ({ name, columns }) => {
    await knex.schema.createTable(name, (table) => {
      // add auto incrementing id column of type INT
      table.increments()

      // add standard datetime fields
      table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
      table.timestamp('updated_at', { useTz: false }).defaultTo(knex.fn.now())
      table.timestamp('deleted_at', { useTz: false })

      columns.forEach(({ name, type, unique, charLimit }) => {
        switch (type) {
          case ColType.String:
            table.string(name, charLimit)
            break
          case ColType.Int:
            table.integer(name, charLimit)
            break
          case ColType.Text:
            table.text(name)
            break
          default:
            console.warn(
              `Column not created for ${name} because no "type" was provided`,
            )
        }

        if (unique) {
          table.unique([name])
        }
      })
    })

    knex.raw(`
      CREATE TRIGGER ${TIMESTAMP_TRIGGER_NAME}
      BEFORE UPDATE
      ON ${name}
      FOR EACH ROW
      EXECUTE PROCEDURE ${TIMESTAMP_TRIGGER_NAME}();
    `)
  })

  await Promise.all(promises)

  await knex.schema.createTable('notion_databases', (table) => {
    table.increments().primary()
    table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: false }).defaultTo(knex.fn.now())
    table.timestamp('deleted_at', { useTz: false })
    table.string('notion_database_id')
    table
      .integer('notion_integration_id')
      .notNullable()
      .references('id')
      .inTable('notion_integrations')
      .onDelete('CASCADE')
  })

  await knex.schema.createTable('subscriptions', (table) => {
    table.increments().primary()
    table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: false }).defaultTo(knex.fn.now())
    table.timestamp('deleted_at', { useTz: false })
    table.string('stripe_customer_id')
    table.string('stripe_subscription_id')
    table.string('subscription_status')
    table.integer('current_period_start')
    table.integer('current_period_end')
    table.integer('canceled_at')
    table.boolean('cancel_at_period_end')
    table.string('stripe_price_id')
    table.string('stripe_product_id')
    table
      .string('userfront_user_id')
      .notNullable()
      .references('userfront_user_id')
      .inTable('users')
      .onDelete('CASCADE')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP FUNCTION IF EXISTS ${TIMESTAMP_TRIGGER_NAME}() CASCADE;
  `)

  const promises = tableConfigs.map(async ({ name }) => {
    return knex.schema.dropTableIfExists(name)
  })

  await Promise.all(promises)
}

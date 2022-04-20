import { Knex } from "knex";

enum ColType {
  String = 'string',
  Int = 'integer'
}

interface ColumnConfig {
  name: string
  type: ColType
  unique?: boolean
}

interface TableConfig {
  name: string
  columns: Array<ColumnConfig>
}

const TIMESTAMP_TRIGGER_NAME = 'update_timestamp'

const tableConfigs: Array<TableConfig> = [
  {
    name: 'user_meta',
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
      },
      { 
        name: 'full_name',
        type: ColType.String,
      },
    ]
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
    ]
  },
  {
    name: 'email_threads',
    columns: [
      {
        name: 'subject',
        type: ColType.String,
      },
      {
        name: 'user_meta_id',
        type: ColType.Int,
      },
    ]
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
        type: ColType.String,
      },
      {
        name: 'html_content',
        type: ColType.String,
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
        name: 'user_meta_id',
        type: ColType.Int,
      },
      {
        name: 'user_meta',
        type: ColType.String,
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
    ]
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
      },
    ]
  }
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
  `);

  /**
   * Add each table, their associated columns and ad PG timestamp trigger function
   */
  const promises = tableConfigs.map(async ({ name, columns }) => {
    await knex.schema.createTable(name, table => {
      // add auto incrementing id column of type INT
      table.increments()

      // add standard datetime fields
      table.timestamp('created_at', { useTz: false, }).defaultTo(
        knex.fn.now(),
      )
      table.timestamp('updated_at', { useTz: false, }).defaultTo(
        knex.fn.now(),
      )
      table.timestamp('deleted_at', { useTz: false, })

      columns.forEach(({ name, type, unique }) => {
        switch(type) {
          case ColType.String:
            table.string(name)
            break
          case ColType.Int: 
            table.integer(name)
            break
          default:
            console.warn(`Column not created for ${name} because no "type" was provided`) 
        }

        if (unique) {
          table.unique([ name ])
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
}


export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP FUNCTION IF EXISTS ${TIMESTAMP_TRIGGER_NAME}() CASCADE;
  `);


  const promises = tableConfigs.map(async ({ name }) => {
    return knex.schema.dropTableIfExists(name)
  })

  await Promise.all(promises)
}

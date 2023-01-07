import { db } from '../db-connection'
import { FREE_TIER_EMAIL_LIMIT } from '../constants'
import { notionClient } from '../notion/notion'
import { NotionDatabase } from '../types/database'

async function main() {
  const userfrontUuid = process.env.USERFRONT_UUID

  if (!userfrontUuid) {
    throw new Error('Please set USERFRONT_UUID.')
  }

  const client = await notionClient(userfrontUuid)

  const notionIntegration = await db
    .notionIntegrations()
    .where('userfront_user_id', userfrontUuid)
    .select('id', 'access_token')
    .first()

  const notionDatabase: Pick<NotionDatabase, 'notionDatabaseId'> = await db
    .notionDatabases()
    .where('notion_integration_id', notionIntegration.id)
    .select('notion_database_id')
    .first()
    
    
  const { notionDatabaseId } = notionDatabase

  // this is an array of objects where each object represents a row in the email inbox database
  const { results: notionRowData } = await client.databases.query({
    database_id: notionDatabaseId,
    // 100 is the current max page size allowed by the Notion API in a single query
    page_size: 100,
  })

  console.log('total rows from notion query:', notionRowData.length)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .then(() => {
    process.exit(0)
  })

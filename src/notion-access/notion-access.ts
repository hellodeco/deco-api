import { Client } from '@notionhq/client'
import 'dotenv/config'

const notion = new Client({ auth: process.env.NOTION_API_KEY })

const notionDatabaseId = process.env.NOTION_DATABASE_ID

export const wipeNotionDatabase = async () => {
  console.log('wipe notion database has started')
  const response = await notion.databases.query({
    database_id: notionDatabaseId,
  })

  const promises = []
  const archivedPageIDs = []

  console.log(response.results)

  response.results.forEach((result) => {
    promises.push(
      new Promise(async () => {
        console.log(result.id)
        await notion.pages.update({
          page_id: result.id,
          archived: true,
        })
        archivedPageIDs.push(result.id)
      }),
    )
  })

  await Promise.all(promises)
  console.log('completed promises')
  return archivedPageIDs
}

// const a = async () => {
//   console.log('This file (wipeNotionDatabase) is loading now')
//   //   const b = await wipeNotionDatabase()
//   //   console.log(b)
//   //   return b
// }

// a()

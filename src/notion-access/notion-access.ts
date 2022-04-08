import { Client } from '@notionhq/client'
import 'dotenv/config'

const notion = new Client({ auth: process.env.NOTION_API_KEY })

const notionDatabaseId = process.env.NOTION_DATABASE_ID

export const wipeNotionDatabase = async () => {
  const response = await notion.databases.query({
    database_id: notionDatabaseId,
  })

  const promises = []
  const archivedPageIDs = []

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
  return archivedPageIDs
}

export const deleteNotionTableProperties = async () => {
  const response = await notion.databases.retrieve({
    database_id: notionDatabaseId,
  })

  const properties = response.properties

  const promises = []

  const props = Object.values(properties)

  props.forEach((property) => {
    if (property.id !== 'title') {
      promises.push(
        new Promise(async () => {
          await notion.databases.update({
            database_id: notionDatabaseId,
            properties: {
              [property.id]: null,
            },
          })
        }),
      )
    }
  })

  await Promise.all(promises)
}

// const a = async () => {
//   console.log('This file (wipeNotionDatabase) is loading now')
//   //   const b = await wipeNotionDatabase()
//   //   console.log(b)
//   //   return b
// }

// a()

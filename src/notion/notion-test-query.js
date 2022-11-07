const { Client } = require('@notionhq/client')

const token = process.env.NOTION_TOKEN
const databaseId = process.env.NOTION_DATABASE_ID

console.log(token, databaseId)

async function query() {
  const notion = new Client({ auth: token })
  const resp = await notion.databases.query({
    database_id: databaseId,
  })

  console.log(resp)
}

setInterval(() => {
  query()
}, 100)

import os from 'os'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { getNotionPageContent } from '../notion/getNotionPageContent'
import { getNotionClient } from '../notion/getNotionClient'

/**
 * * Need to account for possibly nested chilren as noted in the warning here:
 *   https://developers.notion.com/reference/get-block-children
 *
 * * An empty rich_text array on a block signifies a break in content similar to a <br> tag
 *
 * * if `has_children` is true, then the block has children and we need to recursively build out this
 *   tree by making further calls to the Notion API.
 *
 * * The limit of block indentation (aka child blocks) is not clear, so we should limit this ourselves
 *   to a reasonable number to start. Probably like 3-5 is more than enough.
 *
 * * Notion also returns `plain_text` for each block which we should concat together in order to send
 *   plain text along with email requests to the Sendgrid API.
 */

async function main() {
  const userfrontID = process.env.USERFRONT_ID
  const notionPageID = process.env.NOTION_PAGE_ID

  if (!userfrontID) {
    throw new Error('Plz pass a userfront id')
  }

  if (!notionPageID) {
    throw new Error('Plz pass a notion page id')
  }

  const notionClient = await getNotionClient(userfrontID)

  const {
    pageMetadata,
    plainText,
    html,
  } = await getNotionPageContent({
    notionPageID,
    notionClient,
  })

  const htmlPath = path.join(os.tmpdir(), `notion-page-${notionPageID}-${uuidv4()}.html`)
  fs.writeFileSync(htmlPath, html)

  console.log(`Wrote html to: ${htmlPath}`)
  
  console.log(`Open in browser: file://${htmlPath}`)
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })

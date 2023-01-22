import type { Client } from '@notionhq/client'
import { BlockObjectResponse, PartialBlockObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import { getNotionClient } from '../notion/getNotionClient'

type NotionBlock = BlockObjectResponse | PartialBlockObjectResponse & { children?: NotionBlock[] }

export async function convertNotionPageToHtml({
  notionPageId,
  userfrontId,
}: {
  notionPageId: string
  userfrontId: string
}) {
  const notionClient = await getNotionClient(userfrontId)

  /**
   * This retrieves page metadata and properties, but not the actual content
   */
  const pageResp = await notionClient.pages.retrieve({
    page_id: notionPageId,
  })

  console.log(pageResp)

  const blocks = await buildChildTree({
    blockId: notionPageId,
    notionClient,
  })

  console.log(JSON.stringify(blocks, null, 2))
}

/**
 * Given a blockId (or pageId), recursively build out the tree of Notion child blocks
 */
async function buildChildTree({
  blockId,
  notionClient,
  level = 0,
}: {
  blockId: string
  notionClient: Client
  level?: number
}): Promise<NotionBlock[]> {
  let blocks: NotionBlock[] = []

  try {
    let startCursor
    let hasMore = true

    // get all child blocks, making multiple calls to the notion api if necessary 
    while(hasMore) {
      const resp = await notionClient.blocks.children.list({
        block_id: blockId,
        //  100 is the current max at time of writing
        page_size: 100,
        start_cursor: startCursor,
      })

      blocks.push(...(resp.results || []) as NotionBlock[])
      hasMore = resp.has_more
    }
  } catch(err) {
    console.error(err)
  }

  // Limit the number of nesting just in case Notion doesn't have a limit
  // and the user has a VERY deep tree
  if (level > 9) {
    return blocks
  }

  for (let block of blocks) {
    // @ts-ignore
    if (block.has_children) {
      // @ts-ignore
      block.children = await buildChildTree({
        blockId: block.id,
        notionClient,
        level: level + 1,
      })
    } else {
      // @ts-ignore
      block.children = []
    }
  }

  return blocks
}

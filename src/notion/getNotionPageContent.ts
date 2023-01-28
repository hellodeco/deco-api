import type { Client } from '@notionhq/client'
import {
  BlockObjectResponse,
  PartialBlockObjectResponse,
} from '@notionhq/client/build/src/api-endpoints'
import { getNotionClient } from '../notion/getNotionClient'

type NotionBlock = (BlockObjectResponse | PartialBlockObjectResponse) & {
  children?: NotionBlock[]
  type: string
}

export async function getNotionPageContent({
  notionPageID,
  notionClient,
}: {
  notionPageID: string
  notionClient: Client
}) {
  const pageMetadata = await notionClient.pages.retrieve({
    page_id: notionPageID,
  })

  /**
   * TODO filter out the "Send this email" link that we auto add to the Notion page
   */

  const blocks = await buildChildTree({
    blockId: notionPageID,
    notionClient,
  })

  return {
    pageMetadata,
    plainText: blocksToPlainText({ blocks }),
  }
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

    // get all child blocks within the current level, making multiple calls to the notion api if necessary
    while (hasMore) {
      const resp = await notionClient.blocks.children.list({
        block_id: blockId,
        //  100 is the current max at time of writing
        page_size: 100,
        start_cursor: startCursor,
      })

      blocks.push(...((resp.results || []) as NotionBlock[]))
      hasMore = resp.has_more
    }
  } catch (err) {
    console.error(
      'Error querying for notion blocks while converting notion page to html.',
      err,
    )
  }

  // filter out the send link that we include in the Notion reply page.
  if (level === 0) {
    blocks = blocks.filter((block) => {
      const { type } = block
      if (type === 'callout') {
        // TODO update this regex to match the path used on the "send this email" link.
        return !block[type]?.rich_text?.some(({ href }: { href: string }) => {
          const regex = /^https:\/\/google.com$/
          return regex.test(href)
        })
      }

      return true
    })
  }

  for (let block of blocks) {
    block.children = []
  }

  // Limit the number of nesting just in case Notion doesn't have a limit
  // and the user has a VERY deep tree
  if (level > 15) {
    return blocks
  }

  for (let block of blocks) {
    // @ts-ignore
    if (block.has_children) {
      block.children = await buildChildTree({
        blockId: block.id,
        notionClient,
        level: level + 1,
      })
    }
  }

  return blocks
}

function blocksToPlainText({ blocks }: { blocks: NotionBlock[] }) {
  const contentLines = []
  for (let block of blocks) {
    let contentStr = ''

    // rich_text will not exist for non text based blocks such as images.
    const richText = block[block.type].rich_text || []

    // stitch together the current rich text line
    for (let richTextObj of richText) {
      contentStr += richTextObj.plain_text
    }

    // if there was a rich text line, then add a newline.
    // otherwise skip this to avoid unecessary line breaks.
    if (contentStr.length) {
      contentStr += '\n'
    }

    contentLines.push(contentStr)

    contentLines.push(
      blocksToPlainText({
        blocks: block.children,
      }),
    )
  }

  return contentLines.join('')
}

import type { Client } from '@notionhq/client'
import {
  BlockObjectResponse,
  PartialBlockObjectResponse,
} from '@notionhq/client/build/src/api-endpoints'
import htmlCreator from 'html-creator'
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

  const blocks = await buildChildTree({
    blockId: notionPageID,
    notionClient,
  })

  return {
    pageMetadata,
    plainText: blocksToPlainText({ blocks }),
    html: blocksToHTML({ blocks }),
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

function blocksToPlainText({ blocks }: { blocks: NotionBlock[] }): string {
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

function blocksToHTML({ blocks }: { blocks: NotionBlock[] }) {

  const html = new htmlCreator([
    {
      type: 'head',
      content: [{ type: 'title', content: 'Generated HTML' }]
    },
    {
      type: 'body',
      attributes: { style: 'padding: 1rem' },
      content: blocksToHTMLContent({ blocks })
    },
  ])


  return html.renderHTML()
}

const notionTypeToHTMLMap = {
  heading_1: 'h1',
  heading_2: 'h2',
  heading_3: 'h3',
  paragraph: 'p',
  bulleted_list_item: 'li',
  numbered_list_item: 'li',
}

function blocksToHTMLContent({ blocks }: { blocks: NotionBlock[] }): any[] {
  const content = []
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]

    // if (block.type === 'numbered_list_item' && blocks[i - 1]?.type !== 'numbered_list_item') {
    //   console.log('pushing opening ol')
    //   content.push({
    //     type: 'ol',
    //   })
    // }

    /**
     * compress any rich_text items into an HTML node.
     */
    content.push({
      type: notionTypeToHTMLMap[block.type],
      // keep track of the "notion type" so that we can use this later on to add "ol", "ul", etc.
      notionType: block.type,
      content: block[block.type].rich_text.reduce((acc, richTextItem, idx, richText) => {
        const { type, annotations } = richTextItem
        const styles = []

        // if this is null, then a simple text node will be added.
        let htmlType = null

        if (annotations.bold) {
          htmlType = 'span'
          styles.push('font-weight: bold')
        }

        if (annotations.italic) {
          htmlType = 'span'
          styles.push('font-style: italic')
        }

        const attributes: { [key: string]: string } = { style: styles.join(';') }

        if (richTextItem[type].link) {
          htmlType = 'a'
          attributes.href = richTextItem[type].link.url
          attributes.target = '_blank'
        }

        acc.push({
          type: htmlType,
          content: richTextItem[type].content,
          attributes,
        })

        return acc
      }, [])
    })

    // if (block.type === 'numbered_list_item' && block[i + 1]?.type !== 'numbered_list_item') {
    //   console.log('pushing closing ol')
    //   content.push({
    //     type: 'ol',
    //   })
    // }
  }

  const finalContent = []
  for (let i = 0; i < content.length; i++) {
    const item = content[i]

    // Begin handling ordered lists
    if (['bulleted_list_item', 'numbered_list_item'].includes(item.notionType)) {
      const originalListType = item.notionType
      const olContent = []
      while (true) {
        if (content[i]?.notionType !== originalListType) {
          break
        }

        olContent.push({ ...content[i] })

        i++
      }

      i--

      finalContent.push({
        type: originalListType === 'numbered_list_item' ? 'ol' : 'ul',
        content: olContent
      })
    } else {
      finalContent.push(item)
    }

  }

  return finalContent

  // return content.reduce((acc, item, i, content) => {
  //   if (item.type === 'numbered_list_item' && content[i - 1]?.type !== 'numbered_list_item') {
  //     console.log('pushing opening ol')
  //     acc.push({
  //       type: 'ol',
  //       content: [],
  //     })
  //   }

  //   acc.push({
  //     ...item,
  //     type: notionTypeToHTMLMap[item.type],
  //   })

  //   if (item.type === 'numbered_list_item' && content[i + 1]?.type !== 'numbered_list_item') {
  //     console.log('pushing closing ol')
  //     acc.push({
  //       type: 'ol',
  //     })
  //   }

  //   return acc
  // }, [])
}

import type { Client } from '@notionhq/client'
import {
  BlockObjectResponse,
  PartialBlockObjectResponse,
} from '@notionhq/client/build/src/api-endpoints'
import htmlCreator from 'html-creator'
import { getEmailSubjectFromPageMetadata } from '../notion/pageMetadataUtils'
import { NotionEmailPageMetadata } from '../types/notion'

type NotionBlock = (BlockObjectResponse | PartialBlockObjectResponse) & {
  children?: NotionBlock[]
  type: string
}

export async function getNotionPageContent({
  notionPageID,
  notionClient,
  defaultSubject,
}: {
  notionPageID: string
  notionClient: Client
  defaultSubject: string
}) {
  const pageMetadata = await notionClient.pages.retrieve({
    page_id: notionPageID,
  }) as NotionEmailPageMetadata

  const blocks = await buildChildTree({
    blockId: notionPageID,
    notionClient,
  })

  const subject = getEmailSubjectFromPageMetadata({
    metadata: pageMetadata,
    defaultSubject,
  })

  // TODO we should do some form of validation that the email addresses found here are valid and formatted correctly
  const to = pageMetadata?.properties?.To?.email
    // allow spaces, commas or a combination of both as delimiters
    ?.split(/,| /g)
    // filter out empty strings
    .filter(Boolean)
    .map((email) => email.trim())


  return {
    pageMetadata,
    subject,
    to,
    plainText: blocksToPlainText({ blocks }),
    html: blocksToHTML({ blocks, subject }),
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

function blocksToHTML({ blocks, subject }: { blocks: NotionBlock[], subject: string }) {
  const html = new htmlCreator([
    {
      type: 'head',
      content: [
        { type: 'title', content: subject },
        {
          type: 'style',
          content: `
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
            } 
          `,
        },
      ]
    },
    {
      type: 'body',
      attributes: { style: 'padding: 1rem' },
      content: blocksToHTMLContent({ blocks })
    },
  ])


  return html.renderHTML({ disablePrettier: true })
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

    if (block.children?.length) {
      content.push({
        type: 'div',
        attributes: { style: 'margin-left: 1rem' },
        content: blocksToHTMLContent({ blocks: block.children })
      })
    }
  }

  const finalContent = []
  for (let i = 0; i < content.length; i++) {
    const item = content[i]

    /**
     * Begin handling ordered lists:
     * compress any rich_text items into an HTML node.
     */
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

      // move back to the previous node since the loop above will advance one past
      // the final list item.
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
}

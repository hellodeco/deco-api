import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { Client } from '@notionhq/client'
import { isArray } from 'lodash'
import { parse, walk, SyntaxKind, INode, IText } from 'html5parser'
import dotenv from 'dotenv'

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') })

/**
 * - anything in a <style> tag should be ignored
 * - anything in a <script> tag should be ignored
 * - we should traverse as far up the tree as possible to determine if something is an <a> tag
 * - images likely won't be represented by text nodes with h1, h2, etc parent nodes and will require special detection
 *    - e.g. detect image node.name === 'img' and then traverse it's attributes to find the src url (also grabbing alt text attribute if possible)
 * - HTML comments are making it into the text nodes so those will need to be filtered out
 * - We'll need to strip out mso if/else clauses.
 *    - https://stackoverflow.com/questions/1036409/how-do-you-remove-mso-conditional-comments-using-javascript
 *    - https://stackoverflow.design/email/base/mso/
 *
 */

const NOTION_CLIENT_ID = process.env.NOTION_CLIENT_ID
const NOTION_CLIENT_SECRET = process.env.NOTION_CLIENT_SECRET
const NOTION_ACCESS_TOKEN = process.env.NOTION_ACCESS_TOKEN

const notion = new Client({ auth: NOTION_ACCESS_TOKEN })

interface NodeExtras {
  id?: string
  parent?: Node
  notionMappingType?: string // eventually should be an enum
  isLink?: boolean
  href?: string
  name?: string
}

type Node = INode & NodeExtras

interface NotionContent {
  blockType: string // eventually should be an enum
  text: string
}

// a list of html types that we will want to translate to notion blocks (e.g. h1 === heading_1)
const blockTypes = new Set([
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'ul',
  'ol',
])

function emptyVal(s: string) {
  let isEmpty = true

  for (let i = 0; i < s.length; i++) {
    let char = s.charAt(i)

    if (char !== ' ' && char !== '\n') {
      isEmpty = false
      break
    }
  }

  return isEmpty
}

export async function parseEmailHTML(html: string) {
  const textNodes: Array<IText & NodeExtras> = []

  const ast = parse(html)

  walk(ast, {
    enter: (node: Node, parent: Node) => {
      // adding the parent allows us to traverse back up a tree to determine what
      // the notion block type of a text node
      node.parent = parent

      // only include text nodes but ignore text nodes that are actually the child of a style tag
      // as these will contain JS and CSS
      if (node.type === SyntaxKind.Text && parent?.name !== 'style') {
        textNodes.push(node)
      }
    },
  })

  const filteredNodes = textNodes
    .filter(({ value }) => {
      return !emptyVal(value)
    })
    .map((node) => {
      node.value = node.value.replace(/^\s+|\s+$/g, '')
      return node
    })

  // determine each node's type
  for (const node of filteredNodes) {
    let parent = node.parent

    while (parent) {
      if (blockTypes.has(parent.name)) {
        node.notionMappingType = parent.name
      }

      if (parent.name === 'a') {
        node.isLink = true
        const hrefAttr = parent.attributes?.find(({ name, value }) => {
          return name?.value === 'href' && value?.value
        })

        node.href = hrefAttr?.value?.value
      }

      if (node.isLink && node.notionMappingType) {
        break
      }

      parent = parent.parent
    }
  }

  return filteredNodes
}

const translationTable = {
  h1: 'heading_1',
  h2: 'heading_2',
  h3: 'heading_3',
  h4: 'heading_3',
  h5: 'heading_3',
  h6: 'heading_3',
  p: 'paragraph',
  ul: 'bulleted_list_item',
  ol: 'numbered_list_item',
}

export function convertNodesToNotionBlocks(nodes: Array<Node>) {
  const blocks = []

  for (const node of nodes) {
    const { isLink, href } = node

    let link = null
    if (isLink && href) {
      link = {
        type: 'url',
        url: href,
      }
    }

    const type = translationTable[node.notionMappingType] || 'paragraph'

    // TODO: actually group <ul> and <ol> nodes into a single list block

    // TODO: use chunkStr() here to ensure that we don't exceed the 2000 character limit
    // for each rich_text object
    blocks.push({
      type,
      [type]: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: node.value,
              link,
            },
          },
        ],
      },
    })
  }

  return blocks
}

async function test() {
  const html = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'notion', 'html-emails', '1.html'),
  )

  const nodes = await parseEmailHTML(html.toString())
  convertNodesToNotionBlocks(nodes)
}

// test()

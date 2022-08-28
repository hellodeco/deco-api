import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { Client } from '@notionhq/client'
// import { parse } from 'node-html-parser'
import type { HTMLElement } from 'node-html-parser'
import { NodeHtmlMarkdown, NodeHtmlMarkdownOptions } from 'node-html-markdown'
import { parse, walk, SyntaxKind, INode } from 'html5parser';

const nhm = new NodeHtmlMarkdown();

const NOTION_API_KEY = ''
const NOTION_DATABASE_ID = ''

const notion = new Client({ auth: NOTION_API_KEY })

interface NodeExtras {
  id?: string
  parent?: Node
  notionMappingType?: string // eventually should be an enum
  name?: string
}

type Node = INode & NodeExtras

interface NotionContent {
  blockType: string // eventually should be an enum
  text: string 
}

const blockTypes = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  // 'ul',
  // 'ol',
  // 'span',
]

const translationTable = {
  title: 'h1',
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h3',
  h5: 'h3',
  h6: 'h3',
  p: 'p',
  ul: 'bullet list item block',
  ol: 'numbered list item block',
  span: 'p', // spans might also be inside of headings and such so maybe we should check for that?
  // strong: 'bold',
}


export async function parseEmailHTML(html: string) {
  console.log('parsing...')
  const textEls: Array<Node> = []

  const ast = parse(html)
  
  walk(ast, {
    enter: (node: Node, parent: Node) => {
      node.parent = parent

      if (blockTypes.includes(node.name)) {
        node.notionMappingType = node.name
      }

      if (node.type !== 'Text') {
        return
      }

      let notionMappingType
      let currNode: Node = node

      while (!notionMappingType && currNode) {

        if (currNode.notionMappingType) {
          notionMappingType = currNode.notionMappingType
          break
        }

        currNode = currNode.parent
      }

      if (!notionMappingType) {
        notionMappingType = 'p'

      }

      node.notionMappingType = notionMappingType

      textEls.push(node)

      console.log(node)
    },
    leave: (node, parent) => {
    },
  })


  console.log(
    'textEls',
    textEls
    .map((node) => node)
    .filter(({ value }) => value !== '\n'
  ))

  // const resp = await notion.pages.create({
  //   parent: { database_id: notionDatabaseId },
  // })
}

function flattenTree(root: HTMLElement): Array<HTMLElement> {
  
  return []

}



// We care about:
// 1. images
// 2. text


// ul 



function test() {
  const html = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'notion', 'html-emails', '1.html')
  )

  parseEmailHTML(html.toString())
}

test()

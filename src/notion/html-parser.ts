import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { Client } from '@notionhq/client'
// import { parse } from 'node-html-parser'
import type { HTMLElement } from 'node-html-parser'
import { NodeHtmlMarkdown, NodeHtmlMarkdownOptions } from 'node-html-markdown'
import { parse, walk, SyntaxKind, INode, IText } from 'html5parser';

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

// a list of html types that we will want to translate to notion blocks (e.g. h1 === heading_1)
const blockTypes = new Set([
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
])

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
  let textEls: Array<IText & NodeExtras> = []

  const ast = parse(html)
  
  walk(ast, {
    enter: (node: Node, parent: Node) => {
      // adding the parent allows us to traverse back up a tree to determine what
      // the notion block type of a text node
      node.parent = parent

      // if (blockTypes.has(node.name)) {
      //   node.notionMappingType = node.name
      // }

      if (node.type === 'Text') {
        textEls.push(node)
      }

      // let notionMappingType
      // let currNode: Node = node

      // while (!notionMappingType && currNode) {

      //   if (currNode.notionMappingType) {
      //     notionMappingType = currNode.notionMappingType
      //     break
      //   }

      //   currNode = currNode.parent
      // }

      // if (!notionMappingType) {
      //   notionMappingType = 'p'

      // }

      // node.notionMappingType = notionMappingType

      // textEls.push(node)

      // console.log(node)
    },
    leave: (node, parent) => {
    },
  })


  textEls = textEls.filter(({ value }) => {
      return !emptyVal(value)

      return !value.match(/\n/g)    
  })

  console.log(
    'textEls',
    textEls
  )

  // const resp = await notion.pages.create({
  //   parent: { database_id: notionDatabaseId },
  // })
}

function emptyVal(s: string) {
  let isEmpty = true

  let prev

  for (let i = 0; i < s.length; i++) {
    let char = s.charAt(i)

    let isNewLine = char === '\n' || (prev === '\\' && char === 'n')

    if (isNewLine) {
      console.log(isNewLine, char, prev)
    }

    if (!isNewLine || char !== ' ') {
      isEmpty = false
      break
    }

    prev = char
  }

  return isEmpty
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

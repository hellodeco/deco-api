import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { Client } from '@notionhq/client'
import { isArray } from 'lodash'
import { parse, walk, SyntaxKind, INode, IText } from 'html5parser';



/**
 * - anything in a <style> tag should be ignored
 * - anything in a <script> tag should be ignored
 * - we should traverse as far up the tree as possible to determine if something is an <a> tag
 * 
 */


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

  fs.writeFileSync(path.join(__dirname, 'ast.json'), JSON.stringify(ast, null, 2))

  walk(ast, {
    enter: (node: Node, parent: Node) => {
      // adding the parent allows us to traverse back up a tree to determine what
      // the notion block type of a text node
      node.parent = parent

      if (node.type === SyntaxKind.Text) {
        textEls.push(node)
      }
    },
    leave: (node, parent) => {
    },
  })


  textEls = textEls.filter(({ value }) => {

    return true


    // return !emptyVal(value)

    // return !value.match(/\n/g)    
  })

  const t = textEls.reduce((str, { value }) => {
    str += value.trim()
    
    return str
  }, '')



  console.log(ast)

}

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


function test() {
  const html = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'notion', 'html-emails', '1.html')
  )

  parseEmailHTML(html.toString())
}

test()

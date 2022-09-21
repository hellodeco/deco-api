import fs from 'fs'
import path from 'path'
import puppeteer from 'puppeteer'
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


let browser

async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch()
  }

  return browser
}

function emptyVal(s: string) {
  let isEmpty = true

  for (let i = 0; i < s.length; i++) {
    let char = s.charAt(i)

    if (char !== ' ' && char !== '\n' && char !== '\t') {
      isEmpty = false
      break
    }
  }

  return isEmpty
}

// TODO make type stronger
export function convertNodesToNotionBlocks(nodes: Array<any>) {
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

    const type = node.notionBlockType || 'paragraph'

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
              // @ts-ignore
              content: node.text,
              link,
            },
          },
        ],
      },
    })
  }

  return blocks
}

async function renderHTML(html: string) {
  const browser = await getBrowser()

  const page = await browser.newPage()
  await page.setViewport({
      width: 3000,
      height: 3000,
      deviceScaleFactor: 1,
  })

  await page.setContent(html)

  return page
}

export async function getNotionBlocks(html: string) {
  const page = await renderHTML(html)

  let textNodes = await page.evaluate(() => {

    const isAnchor = (node: Node, tagName: string) => {
      let parent = node.parentElement

      while (parent) {
        if (parent.tagName === tagName) {
          // @ts-ignore
          return [true, parent.href]
        }

        parent = parent.parentElement
      }

      return [false, null]
    }

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)

    const nodes = []

    let node = walker.nextNode()

    while (node !== null) {
      const style = getComputedStyle(node.parentElement)
      const [isLink, href] = isAnchor(node, 'A')

      nodes.push({
        text: node.textContent,
        fontSize: style.getPropertyValue('font-size'),
        nodeType: node.nodeType,
        isLink,
        href, 
      })

      node = walker.nextNode()
    }

    return nodes
  })

  textNodes = textNodes
    .filter(node => {
      return !emptyVal(node.text)
    })
    .map(node => {
      let fontSize
      try {
        fontSize = parseInt(node.fontSize.replace('px', ''), 10)
      } catch (err) {
        console.warn('Error getting font size:', err)
        fontSize = 12
      }

      let notionBlockType = 'paragraph'

      if (fontSize >= 30) {
        notionBlockType = 'heading_1'
      } else if (fontSize >= 24) {
        notionBlockType = 'heading_2'
      } else if (fontSize >= 18) {
        notionBlockType = 'heading_3'
      } 

      return {
        ...node,
        text: node.text.replace(/^\s+|\s+$/g, ''),
        notionBlockType,
      }
    })

  const blocks = convertNodesToNotionBlocks(textNodes)

  // TODO type this return value
  return blocks
}

async function test() {
  const html = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'notion', 'html-emails', '7.html'),
  )

  const blocks = await getNotionBlocks(html.toString())
  console.log(JSON.stringify(blocks, null, 2))
}

// test()


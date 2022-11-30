import fs from 'fs'
import path from 'path'
import { isNumber } from 'lodash'
import puppeteer from 'puppeteer'
import type { Browser } from 'puppeteer'
import dotenv from 'dotenv'
import { wait, chunkStr } from '../utils'


interface ContentNode {
  // text specific properties
  text?: string
  fontSize?: string
  fontWeight?: string | number
  fontStyle?: string
  nodeType?: number // TODO make this an enum. Also TODO this can probably be removed since it's not used?
  isLink?: boolean

  // image specific properties
  href?: string
  src?: string
  isImage?: boolean 
  altText?: string 

  // universal properties
  notionBlockType?: string

  // children to use with text type nodes that may have anchor or span elements as children that need
  // to be combined into a single Notion block
  children: ContentNode[]
}

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') })

/**
 * Puppeteer browser instance
 */
let browser: Browser = null

/**
 * Boolean to create a "lock" so that we never try to create more than one puppeteer browser instance
 */
let isObtainingBrowser = false

function setBrowserLock(shouldLock: boolean) {
  /**
   * Use set immediate to ensure that this lock is set/unset before any time callbacks are executed.
   * This is important as we use "wait" which calls setTimeout when waiting for the lock to be released
   * and using setImmediate ensures that the lock is toggled before the callback fires
   */
  setImmediate(() => {
    isObtainingBrowser = shouldLock
  })
}

async function getBrowser() {
  if (!browser && !isObtainingBrowser) {
    setBrowserLock(true)

    browser = await puppeteer.launch()

    setBrowserLock(false)
  }

  while (isObtainingBrowser) {
    await wait(200)
  }

  return browser
}

/**
 * Determines if a string contains *only* the following chars:
 *
 * - '' (empty string)
 * - ' ' (white space)
 * - '\n' (new line)
 * - '\t' (tab)
 */
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

function convertContentNodeToNotionRichText(node: ContentNode) {
  const { isLink, href } = node

  let link = null
  if (isLink && href) {
    link = {
      type: 'url',
      url: href,
    }
  }

  const bold =
    node.fontWeight === 'bold' ||
    (isNumber(node.fontWeight) && node.fontWeight >= 600)
  const italic = node.fontStyle === 'italic'

  // Notion limits each rich text entry to 2000 chars maximum
  const textChunks = chunkStr(node.text, 2000)

  const richText = textChunks.map((chunk) => {
    return {
      type: 'text',
      text: {
        content: chunk,
        link,
      },
      annotations: {
        bold,
        italic,
      },
    }
  })

  return richText
}

// TODO make nodes type stronger
export function convertNodesToNotionBlocks(nodes: ContentNode[]) {
  const blocks = []

  for (const node of nodes) {
    if (node.isImage) {
      // TODO: attempt to scale images to the approximate size they were in the DOM
      blocks.push({
        type: 'image',
        image: {
          type: 'external',
          external: {
            url: node.src,
          },
        },
      })

      continue
    }

    const type = node.notionBlockType || 'paragraph'

    let richText = []
    if (node.children) {
      // TODO do stuff here
      let isLastNode = false
      for (let contentNode of node.children) {
        if (contentNode.text) {
          contentNode.text += ' '
        }

        richText.push(...convertContentNodeToNotionRichText(contentNode))
      }
    } else {
      richText.push(...convertContentNodeToNotionRichText(node))
    }

    blocks.push({
      type,
      [type]: {
        rich_text: richText,
      },
    })

    // const { isLink, href } = node

    // let link = null
    // if (isLink && href) {
    //   link = {
    //     type: 'url',
    //     url: href,
    //   }
    // }

    // const type = node.notionBlockType || 'paragraph'

    // const bold =
    //   node.fontWeight === 'bold' ||
    //   (isNumber(node.fontWeight) && node.fontWeight >= 600)
    // const italic = node.fontStyle === 'italic'

    // // TODO: actually group <ul> and <ol> nodes into a single list block

    // // Notion limits each rich text entry to 2000 chars maximum
    // const textChunks = chunkStr(node.text, 2000)

    // const richText = textChunks.map((chunk) => {
    //   return {
    //     type: 'text',
    //     text: {
    //       content: chunk,
    //       link,
    //     },
    //     annotations: {
    //       bold,
    //       italic,
    //     },
    //   }
    // })

    // const richText = convertContentNodeToNotionRichText(node)

    // const type = node.notionBlockType || 'paragraph'

    // blocks.push({
    //   type,
    //   [type]: {
    //     rich_text: richText,
    //   },
    // })
  }

  return blocks
}

async function setupPageAndRenderHTML(html: string) {
  const browser = await getBrowser()

  const page = await browser.newPage()
  await page.setJavaScriptEnabled(false)

  await page.setRequestInterception(true)

  page.on('request', (request) => {
    /**
     * Some HTML documents have script tags whose src URL will redirect indefinitely.
     * The result is that the Puppeteer max timeout is exceeded and the and the process
     * aborts and throws an error. This check allows us to ignore any requests that
     * have redirected more than the given number of times.
     *
     * **Note** 9 was somewhat chosen at random and may need to be adjusted in the future.
     */
    if (request.redirectChain().length > 9) {
      request.abort()
    } else {
      request.continue()
    }
  })

  await page.setViewport({
    width: 3000,
    height: 3000,
    deviceScaleFactor: 1,
  })

  await page.setContent(html)

  return page
}

function processContentNode(node: ContentNode) {
  if (node.isImage) {
    return node
  }

  let fontSize
  try {
    fontSize = parseInt(node.fontSize.replace('px', ''), 10)
  } catch (err) {
    console.warn('Error parsing font size:', err)
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

  let fontWeight = node.fontWeight

  try {
    if (isNumber(node.fontWeight)) {
      fontWeight = parseInt(node.fontWeight as unknown as string, 10)
    }
  } catch (err) {
    // noop because fontWeight is probably set to "bold" or something similar which
    // is not convertible to an integer
  }

  return {
    ...node,
    text: node.text ? node.text.replace(/^\s+|\s+$/g, '') : null,
    children: node.children ?  node.children.map(node => processContentNode(node)) : null,
    fontWeight,
    notionBlockType,
  }
}


export async function convertHTMLToNotionBlocks(html: string) {
  let page
  try {
    page = await setupPageAndRenderHTML(html)
  } catch (err) {
    console.error(err)
    return []
  }

  let textNodes: ContentNode[] = await page.evaluate(() => {
    const isAnchor = (node: Node) => {
      let parent = node.parentElement

      while (parent) {
        if (parent.tagName === 'A') {
          // @ts-ignore
          return [true, parent.href]
        }

        parent = parent.parentElement
      }

      return [false, null]
    }

    const getTextNodeData = (node: Node) => {
      const style = getComputedStyle(node.parentElement)
      const [isLink, href] = isAnchor(node)

      return {
        text: node.textContent,
        fontSize: style.getPropertyValue('font-size'),
        fontWeight: style.getPropertyValue('font-weight'),
        fontStyle: style.getPropertyValue('font-style'),
        nodeType: node.nodeType,
        isLink,
        href,
      }
    }

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ALL)

    const nodes = []

    const textNodeTypes = ['P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']
    const inlineNodeTypes = ['A', 'B', 'I', 'STRONG', 'EM', 'SPAN']

    let node = walker.nextNode()

    const combineChildTextNodes = (parentNode: Node) => {
      const nextNodeSibling = parentNode.nextSibling

      const children = []

      let currNode = null

      while (true) {
        currNode = walker.nextNode()

        // when we get to the next sibling of the parent node, we know that we've finished
        // traversing the parent node's children tree
        if (currNode === nextNodeSibling) {
          break
        }

        if (currNode.nodeType === Node.TEXT_NODE) {
          const contentNode = getTextNodeData(currNode)
          children.push(contentNode)
        }
      }

      walker.previousNode()

      const style = getComputedStyle(node as Element)
      
      return {
        fontSize: style.getPropertyValue('font-size'),
        fontWeight: style.getPropertyValue('font-weight'),
        fontStyle: style.getPropertyValue('font-style'),
        nodeType: node.nodeType,
        children
      }
    }

    while (node !== null) {
      // @ts-ignore
      if (textNodeTypes.includes(node.tagName)) {
        const parentNode = combineChildTextNodes(node)
        nodes.push(parentNode)
      } else if (node.nodeType === Node.TEXT_NODE) {
        const style = getComputedStyle(node.parentElement)
        const [isLink, href] = isAnchor(node)

        const contentNode = {
          text: node.textContent,
          fontSize: style.getPropertyValue('font-size'),
          fontWeight: style.getPropertyValue('font-weight'),
          fontStyle: style.getPropertyValue('font-style'),
          nodeType: node.nodeType,
          isLink,
          href,
        }

        nodes.push(contentNode)
      } else if (
        node.nodeType === Node.ELEMENT_NODE &&
        // @ts-ignore
        node.tagName === 'IMG'
      ) {
        nodes.push({
          // @ts-ignore
          src: node.getAttribute('src'),
          isImage: true,
          // @ts-ignore
          altText: node.getAttribute('alt'),
        })
      }

      node = walker.nextNode()
    }

    return nodes
  })

  // returns a promise, but we don't necessarily need to wait for it to resolve
  // before continuing with parsing. We just want to eventually free up memory
  // etc for future parsing operations.
  page.close()

  textNodes = textNodes
    .filter((node) => {
      if (node.children) {
        // TODO make sure that we run filter logic just in case a text child node has an image as a child
        return true
      }

      if (!node.isImage) {
        return !emptyVal(node.text)
      }

      /**
       * image extensions as taken from here:
       * https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types
       */
      const imageExts = [
        '.png',
        '.jpg',
        '.jpeg',
        '.gif',
        '.svg',
        '.avif',
        '.gif',
        '.tiff',
        '.webp',
      ]

      const url = new URL(node.src)
      const ext = path.extname(url.pathname)

      return imageExts.includes(ext)
    })
    .map(node => processContentNode(node))

  const blocks = convertNodesToNotionBlocks(textNodes)

  // TODO type this return value
  return blocks
}

import fs from 'fs'
import path from 'path'
import { isNumber } from 'lodash'
import puppeteer from 'puppeteer'
import type { Browser } from 'puppeteer'
import dotenv from 'dotenv'
import { wait, chunkStr, chunkArr } from '../utils'
import { IS_LOCAL } from '../constants'

interface ContentNode {
  // text specific properties
  text?: string
  fontSize?: string
  fontWeight?: string | number
  fontStyle?: string
  nodeType?: number // TODO make this an enum.
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

    /**
     * The Notion API limits the number rich_text objects to 100.
     * If there are more than 100 rich_text objectsj, we need to break them up into multiple blocks
     * or else the request to Notion will fail.
     */
    const richTextChunks = chunkArr(richText, 100)

    for (let richTextChunk of richTextChunks) {
      blocks.push({
        type,
        [type]: {
          rich_text: richTextChunk,
        },
      })
    }
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

  if (IS_LOCAL) {
    page.on('console', async (msg) => {
      console.log('[console.log from puppeteer browser]', msg.text())
      return
    })
  }

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

  if (fontSize >= 32) {
    notionBlockType = 'heading_1'
  } else if (fontSize >= 26) {
    notionBlockType = 'heading_2'
  } else if (fontSize >= 22) {
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
    children: node.children
      ? node.children.map((node) => processContentNode(node))
      : null,
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
    const isValidLink = (link: string) => {
      // filter out any relative links as these don't really do any good within
      // the context of a notion page.
      const invalidStartChars = [
        '/',
        '#',
        'wallet://',
        'about:blank',
      ]
      return invalidStartChars.every((char) => !link.startsWith(char))
    }

    const isAnchor = (node: Node) => {
      let parent: HTMLElement & { href?: string } = node.parentElement

      while (parent) {
        if (parent.tagName === 'A' && isValidLink(parent.href)) {
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

    // add span, a, etc here?
    // const textNodeTypes = ['P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SPAN', 'STRONG', 'A']
    const textNodeTypes = ['P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']
    const inlineNodeTypes = ['A', 'B', 'I', 'STRONG', 'EM', 'SPAN']

    let node = walker.nextNode()

    while (node !== null) {
      // @ts-ignore
      if (textNodeTypes.includes(node.tagName)) {
        const nextNodeSibling = node.nextSibling

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

        // the final node we end on is not a child of "parentNode", so traverse back one node
        // so that "parentNode's" next sibling can get processed on the next loop iteration
        walker.previousNode()

        const style = getComputedStyle(node as Element)

        const parentNode = {
          fontSize: style.getPropertyValue('font-size'),
          fontWeight: style.getPropertyValue('font-weight'),
          fontStyle: style.getPropertyValue('font-style'),
          nodeType: node.nodeType,
          children,
        }

        nodes.push(parentNode)
      } else if (node.nodeType === Node.TEXT_NODE) {
        const contentNode = getTextNodeData(node)

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
  // etc for future parsing operations because if we don't call page.close(), the
  // page will stay open indefinitely.
  page.close()

  textNodes = textNodes
    .map((node) => {
      if (node.children) {
        node.children.filter((node) => {
          return !emptyVal(node.text)
        })
      }

      return node
    })
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
    .map((node) => processContentNode(node))

  const blocks = convertNodesToNotionBlocks(textNodes)

  // TODO type this return value
  return blocks
}

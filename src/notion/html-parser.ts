import fs from 'fs'
import path from 'path'
import { isNumber } from 'lodash'
import puppeteer from 'puppeteer'
import type { Browser } from 'puppeteer'
import dotenv from 'dotenv'
import { wait, chunkStr } from '../utils'

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

// TODO make nodes type stronger
export function convertNodesToNotionBlocks(nodes: Array<any>) {
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

    const { isLink, href } = node

    let link = null
    if (isLink && href) {
      link = {
        type: 'url',
        url: href,
      }
    }

    const type = node.notionBlockType || 'paragraph'

    const bold = node.fontWeight === 'bold' || (isNumber(node.fontWeight) && node.fontWeight >= 600)
    const italic = node.fontStyle === 'italic'

    // TODO: actually group <ul> and <ol> nodes into a single list block

    // Notion limits each rich text entry to 2000 chars maximum
    const textChunks = chunkStr(node.text, 2000)

    const richText = textChunks.map(chunk => {
      return {
        type: 'text',
        text: {
          content: chunk,
          link,
        },
        annotations: {
          bold,
          italic,
        }
      }
    })

    blocks.push({
      type,
      [type]: {
        rich_text: richText,
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

export async function convertHTMLToNotionBlocks(html: string) {
  let page
  try {
    page = await renderHTML(html)
  } catch (err) {
    console.error(err)
    return []
  }

  try {
    await page.setJavaScriptEnabled(false);
  } catch (err) {
    // do not render HTML in this case as that would pose a security risk
    console.error(err)
    return []
  }

  let textNodes = await page.evaluate(() => {
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

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ALL)

    const nodes = []

    let node = walker.nextNode()

    while (node !== null) {
      if (node.nodeType === Node.TEXT_NODE) {
        const style = getComputedStyle(node.parentElement)
        const [isLink, href] = isAnchor(node)

        nodes.push({
          text: node.textContent,
          fontSize: style.getPropertyValue('font-size'),
          fontWeight: style.getPropertyValue('font-weight'),
          fontStyle: style.getPropertyValue('font-style'),
          nodeType: node.nodeType,
          isLink,
          href, 
        })
      // @ts-ignore
      } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'IMG') {
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

  textNodes = textNodes
    .filter(node => {
      if (!node.isImage) {
        return !emptyVal(node.text)
      }

      /**
       * image extensions as taken from here:
       * https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types
       */
      const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.avif', '.gif', '.tiff', '.webp']

      const url = new URL(node.src)
      const ext = path.extname(url.pathname)

      return imageExts.includes(ext)
    })
    .map(node => {
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
        fontWeight = parseInt(node.fontWeight, 10)
      } catch (err) {
        // noop because fontWeight is probably set to "bold" or something similar which
        // is not convertible to an integer
      }

      return {
        ...node,
        text: node.text.replace(/^\s+|\s+$/g, ''),
        fontWeight,
        notionBlockType,
      }
    })

  const blocks = convertNodesToNotionBlocks(textNodes)

  // TODO type this return value
  return blocks
}

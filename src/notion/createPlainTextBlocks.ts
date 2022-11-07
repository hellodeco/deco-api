import { chunkStr } from '../utils'

export function createPlainTextBlocks(plainTextContent: string) {
  // Notion limits each rich text entry to 2000 chars maximum
  const bodyChunks = chunkStr(plainTextContent, 2000)

  const bodyContentRichText = []

  for (let chunk of bodyChunks) {
    bodyContentRichText.push({
      type: 'text',
      text: {
        content: chunk,
      },
    })
  }

  const content = {
    type: 'paragraph',
    paragraph: {
      rich_text: bodyContentRichText,
    },
  }

  return [content]
}

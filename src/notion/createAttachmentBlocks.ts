import { EmailAttachment } from '../types/database'
import { FRONTEND_BASE_URL } from '../constants'

export function createAttachmentBlocks(attachments: Array<EmailAttachment>) {
  const attachmentContent = []

  const attachmentLinks = attachments.reduce(
    (items, { uuid, filename }, idx) => {
      let url = encodeURI(
        `${FRONTEND_BASE_URL}/files/attachments/${uuid}/${filename}/preview`,
      )

      items.push({
        type: 'text',
        text: {
          content: filename,
          link: {
            url: url,
          },
        },
      })

      if (idx !== attachments.length - 1) {
        items.push({
          type: 'text',
          text: {
            content: ', ',
          },
        })
      }

      return items
    },
    [],
  )

  const attachmentSection = [
    {
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: 'Attachments: ',
            },
            annotations: {
              bold: true,
            },
          },
          // @ts-ignore
          ...attachmentLinks,
        ],
      },
    },
    {
      type: 'divider',
      divider: {},
    },
  ]

  if (attachments.length > 0) {
    attachmentContent.push(...attachmentSection)
  }

  return attachmentContent
}
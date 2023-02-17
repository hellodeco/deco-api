import { EmailAttachment } from '../types/database'
import { SERVER_BASE_URL } from '../constants'
import { createAttachmentSigningToken } from '../auth-utils/create-attachment-signing-token'

export async function createAttachmentBlocks(attachments: Array<EmailAttachment>) {
  const attachmentContent = []

  const augmentedAttachments = await Promise.all(
    attachments.map(async (attachment) => {
      const signingToken = await createAttachmentSigningToken({ attachment })
      return {
        ...attachment,
        signingToken,
      }
    })
  )

  const attachmentLinks = augmentedAttachments.reduce(
    (items, { uuid, filename, signingToken }, idx) => {
      // signing token could be null if there was an error creating it
      if (!signingToken) {
        return items
      }

      const url = encodeURI(
        `${SERVER_BASE_URL}/files/attachments/${uuid}/${filename}?st=${signingToken}`,
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

  return attachmentLinks
}

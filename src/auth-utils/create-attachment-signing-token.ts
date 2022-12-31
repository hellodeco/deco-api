import { promisify } from 'util'
import { randomBytes } from 'crypto'
import bcrypt from 'bcrypt'
import { db } from '../db-connection'
import type { EmailAttachment } from '../types/database'
import { objectCamelToSnake } from '../utils'

const promisifiedRandomBytes = promisify(randomBytes)

async function generateToken() {
  const buf = await promisifiedRandomBytes(20)
  return buf.toString('base64url')
}

// takes an attachment object
// returns the token as a string
export async function createAttachmentSigningToken({
  attachment,
}: {
  attachment: EmailAttachment
}) {
  try {
    const token = await generateToken()
    const hash = await bcrypt.hash(token, 10)

    await db.emailAttachmentTokens()
      .insert(
        objectCamelToSnake({
          emailAttachmentId: attachment.id,
          token: hash,
        })
      )

    return token
  } catch (err) {
    console.error(`Error creating attachment signing token for attachment with uuidid: ${attachment.uuid}`, err)
    return null
  }
}

import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { addEmailToNotion } from '../notion/notion'
import { getNotionClient } from '../notion/getNotionClient'

export interface NewEmail {
  subject: string
  from: string
  emailId?: number
  emailThreadId?: number
  plainTextContent: string
  htmlContent?: string
}

function readHTMLFile(name: string) {
  return fs.readFileSync(path.join(__dirname, 'html', name))
}

async function test() {
  const userfrontID = process.env.USERFRONT_ID
  const htmlFileName = process.env.HTML_FILE_NAME

  if (!userfrontID) {
    throw new Error('Plz pass a userfront id')
  }

  if (!htmlFileName) {
    throw new Error('Plz pass an html file name')
  }

  const htmlContent = readHTMLFile(htmlFileName).toString()

  if (!htmlContent) {
    throw new Error(`No HTML content found in: ${htmlFileName}`)
  }

  const newEmail = {
    subject: 'Test email',
    from: 'jimbob@onlyjack.gay',
    emailId: 123,
    emailThreadId: 456,
    plainTextContent: 'This is a test email',
    htmlContent,
    createdAt: new Date().toISOString(),
    uuid: uuidv4(),
  }

  console.log('adding email to notion...')

  const notionClient = await getNotionClient(userfrontID)

  const { pageId } = await addEmailToNotion({
    newEmail,
    userfrontID,
    notionClient,
  })

  console.log('new page id:', pageId)
}

test()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })

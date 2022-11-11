import path from 'path'
import fs from 'fs'
import { addEmailToNotion } from '../notion';

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
  }

  console.log('adding email to notion...')

  const { pageId } = await addEmailToNotion({
    newEmail,
    userfrontID,
  })

  console.log('new page id:', pageId)
}

test()

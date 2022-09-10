import fs from 'fs'
import path from 'path'
import { parseEmailHTML } from './html-parser'

describe('parseEmailHTML', () => {
  it('works', async () => {
    const html = fs.readFileSync(path.join(__dirname, 'html-emails', '1.html'))

    // console.log('html', html.toString())

    const parsed = parseEmailHTML(html.toString())
  })
})

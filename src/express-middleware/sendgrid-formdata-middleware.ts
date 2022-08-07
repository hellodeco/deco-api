import busboy from 'busboy'
import type { MulterFile } from '../types/shared'

interface opts {
  limits?: {
    fileSize?: number // in bytes
  }
}

export function sendgridFormDataMiddleware({
  limits: { fileSize = Infinity } = {},
}: opts = {}) {
  return async (req, res, next) => {
    const bb = busboy({ headers: req.headers })
    const files: Array<MulterFile> = []

    await new Promise<void>((resolve, reject) => {
      bb.on('file', (name, file, info) => {
        const { filename, encoding, mimeType } = info
        let fileBuffer = null
        let size = 0

        file.on('data', (data) => {
          size += data.length

          if (fileSize && size > fileSize) {
            file.destroy()
            fileBuffer = null
            return
          }

          if (!fileBuffer) {
            fileBuffer = data
            return
          }

          fileBuffer = Buffer.concat([fileBuffer, data])
        })

        file.on('close', () => {
          if (!fileBuffer) {
            return
          }

          files.push({
            // fieldname is assigned internally by Sendgrid
            // this string value is used as the key for file metadata that Sendgrid sends in the "attachment-info" field
            // for example, given the following "attachment-info" JSON string, the file with fieldname "attachment1" will have the following metadata:
            // {"attachment1":{"filename":"verizon-invoice.pdf","name":"verizon-invoice.pdf","type":"application/pdf","content-id":"f_l6gk8e7o0"}} {
            fieldname: name,
            originalname: filename,
            encoding,
            mimetype: mimeType,
            size,
            buffer: fileBuffer,
          })
        })
      })

      bb.on('field', (name, val, info) => {
        req.body[name] = val
      })

      bb.on('close', () => {
        resolve()
      })

      req.pipe(bb)
    })

    req.files = files

    next()
  }
}

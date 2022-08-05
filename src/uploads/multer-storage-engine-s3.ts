import type { ReadStream } from 'fs'
import fs from 'fs'
import type { Request } from 'express'
import client from '../s3-client'

interface File {
  fieldname: string
  originalname: string
  encoding: string
  mimetype: string
  size: string

  // TODO: does this exist?
  stream: ReadStream
}

const wait = (ms = 5000) => new Promise((resolve) => setTimeout(resolve, ms))

class StorageEngineS3 {
  constructor() {}

  _handleFile(req: Request, file: File, cb: (error?: any, info?: any) => void) {
    // noop
    // console.log('in the file handler...', file, file.stream)
    // if (!req.body.files) {
    //   req.body.files = []
    // }
    console.log('handling file...', file)

    // req.body.files.push(file)
    cb(null, {
      fieldname: file.fieldname,
      originalname: file.originalname,
      encoding: file.encoding,
      mimetype: file.mimetype,
      size: file.size,
      stream: file.stream,
    })
  }

  // async _handleFileOld(req: Request, file: File, cb: () => void) {
  //   const { body } = req
  //   const attachmentInfo = body['attachment-info']
  //   // example file arg object:
  //   // {
  //   //   fieldname: 'attachment1',
  //   //   originalname: 'salute.png',
  //   //   encoding: '7bit',
  //   //   mimetype: 'image/png'
  //   // }

  //
  //   console.log('file', file, file.stream)
  //   console.log('file keys', Object.keys(file))
  //   console.log('attachmentInfo', Object.keys(body))

  //   try {
  //     // const writeStream = fs.createWriteStream()

  //     const res = await client.send(new PutObjectCommand({
  //       Bucket: 'attachments',
  //       Key: file.originalname,
  //       Body: file.stream,
  //     }))

  //     console.log(res)
  //   } catch (e) {
  //     console.error(e)
  //   }
  // }

  _removeFile(req, file, cb) {
    // noop
    cb(null, null)
  }
}

export function multerS3() {
  return new StorageEngineS3()
}

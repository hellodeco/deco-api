import { PutObjectCommand } from '@aws-sdk/client-s3'
import { v4 as uuidv4 } from 'uuid'
import { S3_BUCKET } from '../constants'
import s3Client from './s3Client'

import type { MulterFile } from '../types/shared'

export async function storeFiles(files: Array<MulterFile>) {
  const promises = files.map(async (file) => {
    // Example fields on the file object:
    // fieldname: 'attachment1',
    // originalname: 'salute.png',
    // encoding: '7bit',
    // mimetype: 'image/png'
    // size: number

    const uuid: string = uuidv4()
    const key = `${uuid}-${file.originalname}`

    try {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: key,
          Body: file.buffer,
          Metadata: {
            // TODO: should we store file metadata along with the file here?
          },
        }),
      )

      return {
        ...file,
        uuid,
      }
    } catch (err) {
      console.error(`error uploading attachment ${key} to storage bucket`, err)
    }

    return null
  })

  // TODO: do something with files that failed to upload rather than just ignore them
  return (await Promise.all(promises)).filter(Boolean)
}

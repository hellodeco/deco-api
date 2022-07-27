import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  S3_ENDPOINT,
  S3_REGION,
  S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY,
  IS_LOCAL,
} from './constants'

const client = new S3Client({
  endpoint: S3_ENDPOINT,
  region: S3_REGION,
  credentials: {
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: IS_LOCAL ? true : false, // needs to be true for usage with minio which we use for local development
})

export default client

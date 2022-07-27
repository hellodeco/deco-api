import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// example using with minio for local dev emulation: https://docs.min.io/docs/how-to-use-aws-sdk-for-javascript-with-minio-server.html
// unfortunately the best docs for the config object here: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/interfaces/s3clientresolvedconfig.html
const client = new S3Client({
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'KvP403gOIqJYF3UU',
    secretAccessKey: 'bPUfzzEcqHktavpkBmeyoYjHC7azb9c6',
  },
  // @ts-ignore
  // targetPrefix: 'attachments',

  forcePathStyle: true, // needed with minio?,
  // signatureVersion: 'v4',
})

export default client

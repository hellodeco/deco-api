import 'dotenv/config'
import { getSecretFromEnvVarOrFile } from './utils'

function getPort() {
  const defaultPort = 4000
  const overridePort = process.env.PORT && Number(process.env.PORT)

  return overridePort || defaultPort
}

export const PORT = getPort()

export const SERVER_BASE_URL =
  process.env.SERVER_BASE_URL || `http://localhost:${PORT}`

export const FRONTEND_DOMAIN = process.env.FRONTEND_DOMAIN || 'localhost:3000'

const frontEndProtocol = ['production', 'staging'].includes(process.env.NODE_ENV)
  ? 'https://'
  : 'http://'

export const FRONTEND_BASE_URL = `${frontEndProtocol}${FRONTEND_DOMAIN}`

export const NOTION_BASE_URL = 'https://api.notion.com'

export const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN || 'deco.co'

export const JWT_PUBLIC_KEY = getSecretFromEnvVarOrFile({
  envVarName: 'JWT_PUBLIC_KEY',
  fileName: 'userfront-public-key.crt',
});

export const REQUIRED_NOTION_DATABASE_PROPERTIES = [
  'From',
  'Delivered',
  'Email_ID',
  'Name',
]

export enum EmailStatus {
  TO_ADDRESS_NOT_FOUND = 'TO_ADDRESS_NOT_FOUND',
  RECEIVED_TO_DECO = 'RECEIVED_TO_DECO',
  RECEIVED_TO_NOTION = 'RECEIVED_TO_NOTION',
  NOTION_FAILED = 'NOTION_FAILED',
}

export const IS_LOCAL = !['production', 'staging'].includes(process.env.NODE_ENV)

export const USERFRONT_READONLY_API_KEY = process.env.USERFRONT_READONLY_API_KEY

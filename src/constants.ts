import fs from 'fs'
import 'dotenv/config'

/**
 * Reads a secret from a given file if it exists and otherwise defaults to the given
 * environment variable.
 *
 * Render does not handle newline characters correctly when setting them in env vars.
 * If a secret needs newlines, the workaround is to set a secret file and read the secret
 * from that file.
 */
export function getSecretFromEnvVarOrFile({ envVarName, fileName }) {
  let secret = process.env[envVarName]

  const renderDBCertPath = `/etc/secrets/${fileName}`
  if (fs.existsSync(renderDBCertPath)) {
    secret = fs.readFileSync(renderDBCertPath, 'utf-8')
  }

  process.env[envVarName] = secret

  return secret
}

function getPort() {
  const defaultPort = 4000
  const overridePort = process.env.PORT && Number(process.env.PORT)

  return overridePort || defaultPort
}

export const PORT = getPort()

export const SERVER_BASE_URL =
  process.env.SERVER_BASE_URL || `http://localhost:${PORT}`

export const FRONTEND_DOMAIN = process.env.FRONTEND_DOMAIN || 'localhost:3000'

const frontEndProtocol = ['production', 'staging'].includes(
  process.env.NODE_ENV,
)
  ? 'https://'
  : 'http://'

export const FRONTEND_BASE_URL = `${frontEndProtocol}${FRONTEND_DOMAIN}`

export const NOTION_BASE_URL = 'https://api.notion.com'

export const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN || 'deco.so'

export const JWT_PUBLIC_KEY = getSecretFromEnvVarOrFile({
  envVarName: 'JWT_PUBLIC_KEY',
  fileName: 'userfront-public-key.crt',
})

export const IS_LOCAL = !['production', 'staging'].includes(
  process.env.NODE_ENV,
)

export const IS_STAGING = process.env.NODE_ENV === 'staging'

export const USERFRONT_READONLY_API_KEY = process.env.USERFRONT_READONLY_API_KEY

export const NOTION_REDIRECT_URI = `${SERVER_BASE_URL}/oauth/notion/callback`

export const S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://localhost:9000'

export const S3_REGION = process.env.S3_REGION || ''

export const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID

export const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY

export const S3_BUCKET = process.env.S3_BUCKET || ''

export const CORS_ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS || ''

export const FREE_TIER_EMAIL_LIMIT = 100

export const REPLY_FEATURE_ENABLED = ['1', 'true'].includes(process.env.REPLY_FEATURE_ENABLED || '')

export const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || ''

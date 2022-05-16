import fs from 'fs'
import camelcase from 'camelcase'
import { snakeCase } from 'snake-case'
import { SERVER_BASE_URL, FRONTEND_BASE_URL } from '../constants'

export function objectSnakeToCamel(o: { [key: string]: any }) {
  return Object.entries(o).reduce((acc, [k, v]) => {
    acc[camelcase(k)] = v
    return acc
  }, {})
}

export function objectCamelToSnake(o: { [key: string]: any}) {
  return Object.entries(o).reduce((acc, [k, v]) => {
    acc[snakeCase(k)] = v
    return acc
  }, {})
}

export function getNotionRedirectURI() {
  return `${SERVER_BASE_URL}/oauth/notion/callback`
}

export function createNotionAuthFailedRedirectURL({ message }: { message: string }) {
  const params = new URLSearchParams()
  params.append('message', message)
  return `${FRONTEND_BASE_URL}/oauth/notion/fail?${params.toString()}`
}

/**
 * Reads a secret from a given file if it exists and otherwise defaults to the given
 * environment variable.
 *
 * Render does not handle newline characters correctly when setting them in env vars.
 * If a secret needs newlines, the workaround is to set a secret file and read the secret
 * from that file.
 */
export function getSecretFromEnvVarOrFile({ envVarName, fileName }) {
  let secret = process.env[envVarName];

  const renderDBCertPath = `/etc/secrets/${fileName}`;
  if (fs.existsSync(renderDBCertPath)) {
    secret = fs.readFileSync(renderDBCertPath, 'utf-8');
  }

  process.env[envVarName] = secret

  return secret;
}

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
  return `${FRONTEND_BASE_URL}/auth/notion/fail?${params.toString()}`
}

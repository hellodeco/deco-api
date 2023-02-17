import camelcase from 'camelcase'
import { snakeCase } from 'snake-case'
import type { Header } from '../types/shared'
import { FOUNDERS_USERFRONT_IDS } from '../constants'

export function objectSnakeToCamel(o: { [key: string]: any }) {
  return Object.entries(o).reduce((acc, [k, v]) => {
    acc[camelcase(k)] = v
    return acc
  }, {})
}

export function objectCamelToSnake(o: { [key: string]: any }) {
  return Object.entries(o).reduce((acc, [k, v]) => {
    acc[snakeCase(k)] = v
    return acc
  }, {})
}

export function chunkStr(str: string, size: number = 1000): Array<string> {
  let chunks = []

  let start = 0
  let end = size

  while (str.length > start) {
    chunks.push(str.substring(start, end))
    start = end
    end += size
  }

  return chunks
}

export function chunkArr(
  arr: Array<any>,
  size: number = 100,
): Array<Array<any>> {
  let chunks = []

  let start = 0
  let end = size

  while (start < arr.length) {
    chunks.push(arr.slice(start, end))
    start = end
    end += size
  }

  return chunks
}

export function wait(ms = 1000): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// parses a string into a map of header names to arrays of values since each header can have multiple values
export function parseHeaderString(headers: string): HeaderMap {
  const headersArray = headers.split(/\n/)

  const headerMap = {}

  headersArray.forEach((header) => {
    if (header.indexOf(':') < 0) {
      return
    }

    let [key, val] = header.split(': ')

    if (!key || !val) {
      return
    }

    key = key.toLowerCase()

    if (!headerMap[key]) {
      headerMap[key] = []
    }

    headerMap[key].push(val)
  })

  return headerMap
}

type HeaderMap = Record<string, Array<string>>

export function headerMapToArray(
  headerMap: HeaderMap,
  emailId: number,
): Array<Header> {
  return Object.entries(headerMap).reduce((acc, [key, values]) => {
    values.forEach((value) => {
      acc.push({
        key,
        value,
        emailId,
      })
    })

    return acc
  }, [] as Array<Header>)
}

/**
 * Given a string in the form of "First Name <name@domain.com>", returns just the
 * the name portion of the string.
 *
 * For example, given "Jackery Sellwood <jack@deco.so>", this will return "Jackery Sellwood"
 */
export function getFullNameFromEmailToStr(emailToStr: string): string {
  const pattern =
    /\s*<(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])>/i

  return emailToStr.replace(pattern, '').trim()
}

/**
 * Given a string in the form of "First Name <name@domain.com>", returns just the
 * the email portion of the string.
 *
 * For example, given "Jackery Sellwood <jack@deco.so>", this will return "jack@deco.so"
 */
export function getEmailFromEmailToStr(emailToStr: string): string {
  /**
   * Note that this regex does not include the "g" flag, which means that it will always
   * stop at the first match found. If we want to return an array of all matches in the future,
   * the "g" flag simply needs to be added.
   */
  const match = emailToStr.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i);

  return match[0] ? match[0] : null
}

export function isFounder(userfrontID: string) {
  return FOUNDERS_USERFRONT_IDS.includes(userfrontID)
}

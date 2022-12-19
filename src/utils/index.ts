import camelcase from 'camelcase'
import { snakeCase } from 'snake-case'
import type { Header } from '../types/shared'

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

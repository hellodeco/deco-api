import camelcase from 'camelcase'
import { snakeCase } from 'snake-case'

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
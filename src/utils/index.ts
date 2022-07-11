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

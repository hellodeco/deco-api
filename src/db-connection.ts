import knex from 'knex'
import dotenv from 'dotenv'
import camelcase from 'camelcase'

dotenv.config()

function objectSnakeToCamel(o: { [key: string]: any }) {
  return Object.entries(o).reduce((acc, [k, v]) => {
    acc[camelcase(k)] = v
    return acc
  }, {})
}

let ssl = false
if (process.env.NODE_ENV === 'production') {
  ssl = true
}

export default knex({
  client: 'pg',
  useNullAsDefault: true,
  connection: {
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    port: Number(process.env.DATABASE_PORT),
    ssl,
  },
  postProcessResponse: (result) => {
    if (Array.isArray(result)) {
      return result.map(row => objectSnakeToCamel(row));
    } else {
      return objectSnakeToCamel(result);
    }
  },
})

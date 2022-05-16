import path from 'path'
import dotenv from 'dotenv'
import { objectSnakeToCamel } from './utils'

dotenv.config({ path: path.join(__dirname, '..', '.env' )})

let ssl = false
if (['production', 'staging'].includes(process.env.NODE_ENV)) {
  ssl = true
}

export default {
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
  migrations: {
    extension: 'ts',
    directory: path.join('..', 'database', 'migrations',),
  },
  seeds: {
    extension: 'ts',
    directory: path.join('..', 'database', 'seeds',),
  },
  postProcessResponse: (result) => {
    if (!result) {
      return null
    } else if (Array.isArray(result)) {
      return result.map(row => objectSnakeToCamel(row));
    } else {
      return objectSnakeToCamel(result);
    }
  },
}

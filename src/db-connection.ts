import knex from "knex"
import dotenv from "dotenv"

dotenv.config()

let ssl = false;
if (process.env.NODE_ENV === 'production') {
  ssl = true;
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
})

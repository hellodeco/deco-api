import fs from 'fs'
import path from 'path'
import express from 'express'
import { applyMiddleware } from 'graphql-middleware'
import { makeExecutableSchema } from '@graphql-tools/schema'
import permissions from './permissions'
import resolvers from './resolvers/resolvers'
import { createServer } from './create-server'

import 'dotenv/config'

const typeDefs = fs
  .readFileSync(path.join(__dirname, 'schema.graphql'))
  .toString('utf-8')

const schema = applyMiddleware(
  makeExecutableSchema({
    typeDefs,
    resolvers,
  }),
  permissions,
)

const app = express()

createServer({
  schema,
  app,
}).then(({ server, port }) => {
  console.log(`🚀 Server ready at http://localhost:${port}`)
})

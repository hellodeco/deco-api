import fs from 'fs'
import path from 'path'
import { ApolloServer } from 'apollo-server'
import { Resolvers } from './generated/resolvers-types'
import * as dbAccess from './db-access'

interface Context {
  dbAccess: typeof dbAccess
}

const typeDefs = fs
  .readFileSync(path.join(__dirname, 'schema.graphql'))
  .toString('utf-8')

const resolvers: Resolvers<Context> = {
  Query: {
    allEmails: (parent, args, context) => context.dbAccess.getAllEmails(),
  },
}

// The ApolloServer constructor requires two parameters: your schema
// definition and your set of resolvers.
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: {
    dbAccess,
  },
})

// The `listen` method launches a web server.
server.listen().then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`)
})

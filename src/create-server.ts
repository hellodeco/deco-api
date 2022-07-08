import http from 'http'
import type { Express } from 'express'
import { ApolloServer } from 'apollo-server-express'
import { ApolloServerPluginDrainHttpServer } from 'apollo-server-core'
import { GraphQLSchemaWithFragmentReplacements } from 'graphql-middleware/dist/types'
import { PORT } from './constants'
import resolvers, { User } from './resolvers/resolvers'
import * as dbAccess from './db-access/db-access'
import * as notionAccess from './notion-access/notion-access'
import { verifyJWT } from './jwt'

interface StartApolloServerOpts {
  typeDefs: string
  resolvers: typeof resolvers
  schema: GraphQLSchemaWithFragmentReplacements
  app: Express
}

export async function createServer({
  typeDefs,
  resolvers,
  schema,
  app,
}: StartApolloServerOpts) {
  const httpServer = http.createServer(app)
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    schema,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    context: async ({ req }) => {
      let user: User
      const authHeader = req.headers.authorization || ''
      const [, token] = authHeader.split(' ')

      console.log('auth header info', authHeader, token)

      if (token) {
        try {
          user = await verifyJWT(token)
        } catch (err) {
          // console.error(err)
        }
      }

      console.log('user', user)

      return {
        dbAccess,
        user,
        notionAccess,
      }
    },
  })

  await server.start()
  server.applyMiddleware({
    app,
    // path at which the graphql server is hosted
    path: '/api',
  })

  return new Promise<{
    server: typeof server
    port: number
  }>((resolve) => {
    httpServer.listen({ port: PORT }, () => resolve({ server, port: PORT }))
  })
}

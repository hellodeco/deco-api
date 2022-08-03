import http from 'http'
import type { Express } from 'express'
import { ApolloServer } from 'apollo-server-express'
import { ApolloServerPluginDrainHttpServer } from 'apollo-server-core'
import { GraphQLSchemaWithFragmentReplacements } from 'graphql-middleware/dist/types'
import { PORT } from './constants'
import resolvers, { User } from './resolvers/resolvers'
import * as dbAccess from './db-access/db-access'
import { db } from './db-connection'
import * as notionAccess from './notion/notion'
import { verifyJWT } from './jwt'
import { addRoutes } from './addRoutes'
import { ResolverContext } from './types/shared'

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
  addRoutes(app)
  const httpServer = http.createServer(app)
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    schema,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    context: async ({ req }): Promise<ResolverContext> => {
      let user: User
      const authHeader = req.headers.authorization || ''
      const [, token] = authHeader.split(' ')

      if (token) {
        try {
          user = await verifyJWT(token)
        } catch (err) {
          // console.error(err)
        }
      }

      return {
        dbAccess,
        db, // this will eventually replace dbAccess
        user,
        notionAccess,
        headers: {
          referer: req.headers.referer,
        },
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

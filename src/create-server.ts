import http from 'http'
import type { Express } from 'express'
import { ApolloServer } from '@apollo/server'
import { expressMiddleware } from '@apollo/server/express4'
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'
import type { ApolloServerContext } from './types/apollo'
import cors from 'cors'
import { json } from 'body-parser'
import { GraphQLSchemaWithFragmentReplacements } from 'graphql-middleware/dist/types'
import { IS_LOCAL, PORT } from './constants'
import * as dbAccess from './db-access/db-access'
import { db } from './db-connection'
import * as notionAccess from './notion/notion'
import { verifyJWT } from './jwt'
import { addRoutes } from './addRoutes'
import { ResolverContext } from './types/shared'
import type { User } from './types/apollo'

interface StartApolloServerOpts {
  schema: GraphQLSchemaWithFragmentReplacements
  app: Express
}

export async function createServer({
  schema,
  app,
}: StartApolloServerOpts) {
  addRoutes(app)
  const httpServer = http.createServer(app)
  const server = new ApolloServer<ApolloServerContext>({
    schema,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    formatError: (formattedError, error) => {
      if (IS_LOCAL) {
        console.error(error)
      }
      
      return formattedError
    },
  })

  await server.start()

  app.use(
    '/api',
    cors<cors.CorsRequest>(),
    json(),
    expressMiddleware(server, {
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

        // TODO: add these types to the context interface
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
    }),
  )


  return new Promise<{
    server: typeof server
    port: number
  }>((resolve) => {
    httpServer.listen({ port: PORT }, () => resolve({ server, port: PORT }))
  })
}

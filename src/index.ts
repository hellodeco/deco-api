import fs from 'fs'
import path from 'path'
import { ApolloServer } from 'apollo-server'
import { applyMiddleware } from 'graphql-middleware'
import { makeExecutableSchema } from '@graphql-tools/schema'
import jwt from 'jsonwebtoken'
// import permissions from './permissions'
import * as dbAccess from './db-access/db-access'
import * as notionAccess from './notion-access/notion-access'
import resolvers, { User } from './resolvers/resolvers'

async function verifyJWT(token: string): Promise<User | null> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      process.env.JWT_PUBLIC_KEY,
      (err: jwt.VerifyErrors, auth: jwt.JwtPayload) => {
        if (err) {
          return reject(null)
        }

        return resolve({ userfrontID: auth?.userUuid })
      },
    )
  })
}

const typeDefs = fs
  .readFileSync(path.join(__dirname, 'schema.graphql'))
  .toString('utf-8')

const server = new ApolloServer({
  typeDefs,
  resolvers,
  schema: applyMiddleware(
    makeExecutableSchema({
      typeDefs,
      resolvers,
    }),
    // permissions,
  ),
  context: async ({ req }) => {
    let user: User
    const authHeader = req.headers.authorization || ''
    const [, token] = authHeader.split(' ')

    if (token) {
      try {
        user = await verifyJWT(token)
      } catch (err) {}
    }

    return {
      dbAccess,
      user,
      notionAccess,
    }
  },
})

server.listen().then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`)
})

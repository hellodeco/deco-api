import fs from 'fs'
import path from 'path'
import { ApolloServer, AuthenticationError } from 'apollo-server'
import jwt from 'jsonwebtoken'
import { Resolvers } from './generated/resolvers-types'
import * as dbAccess from './db-access'

interface User {
  userfrontID: string
}

interface Context {
  dbAccess: typeof dbAccess
  user: User
}

async function verifyJWT(token: string): Promise<User | null> {
  return new Promise((resolve, reject) => {
    jwt.verify(token, process.env.JWT_PUBLIC_KEY, (err: jwt.VerifyErrors, auth: jwt.JwtPayload) => {
      if (err) {
        return reject()
      }

      return resolve({ userfrontID: auth?.userUuid })
    })
  })
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
  context: async ({ req, }) => {
    let user: User
    const authHeader = req.headers.authorization || ''
    const [, token] = authHeader.split(' ')

    if (!token) {
      throw new AuthenticationError(`No auth token sent with request`) 
    }

    try {
      user = await verifyJWT(token)
    } catch (err) {
      throw new AuthenticationError(`Not authorized`) 
    }

    return {
      dbAccess,
      user,
    }
  },
})

// The `listen` method launches a web server.
server.listen().then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`)
})

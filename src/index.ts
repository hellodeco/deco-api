import fs from "fs"
import path from "path"
import { ApolloServer } from "apollo-server"
import { Resolvers } from "./generated/resolvers-types"

const typeDefs = fs.readFileSync(
  path.join(__dirname, 'schema.graphql')
).toString('utf-8')

const books = [
  {
    title: 'The Awakening',
    author: 'Kate Chopin',
  },
  {
    title: 'City of Glass',
    author: 'Paul Auster',
  },
];

// Resolvers define the technique for fetching the types defined in the
// schema. This resolver retrieves books from the "books" array above.
const resolvers: Resolvers = {
  Query: {
    books: () => books,
    bookByTitle: (_, { title }) => books.find(book => book.title.toLowerCase() === title.toLowerCase()) || null
  },
  Mutation: {
    addBook: (parent, args, context, info) => {
      const { title, author } = args
      console.log(context)
      books.push({ title, author })
      
      return {
        success: true,
        message: 'successfully added a book'
      }
    },
  }
};

// The ApolloServer constructor requires two parameters: your schema
// definition and your set of resolvers.
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: {
    dbAccess: {},
  },
});

// The `listen` method launches a web server.
server.listen().then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`);
});


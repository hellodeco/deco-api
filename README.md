# Hello Deco API

GraphQL / Typescript API with graphql codengen.

## Development

### Adding New Queries / Mutations

#### 1. Update the Schema
The file, `src/schema.graphql` holds all of the graphql types for this app. It's used by Apollo Server to instantiate type definititions internally and also by `@graphql-codegen` to generate Typescript code that backs the schema.

To add a new query to the API, you need to first update the `schema.graphql` file with new types, query fields and mutation fields as necessary.

As an example, let's say you want to add a query to get the current user.

```graphql
# Add a "User" type that represents a user that can be used by queries and mutations
type User {
  fullName: String
  emailAddress: String
  userfrontID: UUID
}

# The "Query" type is always used to hold all queries. Adding fields here is how you add new "endpoints" . 
type Query {
  # This "currentUser" query is equivalent to a REST API's "/currentUser" route
  currentUser: User
}
```

#### 2. Generate Typescript From Schema
Next, run `yarn generate-graphql` to create TS types based on the graphql schema. You'll see how this is useful later on when we write the query resolver.

As a note, the generated typescript code is outputted to `src/generated/resolvers-types.ts` and can be imported and usedlike normal TS types.

#### 3. Add Resolver
A resolver is a function that is responsible for processing an incoming graphql request. Apollo server will take an incoming query, parse it and determine what queries / mutations that it needs to call. Based on that, it will use these resolvers to fetch data from a database, make external API calls, or whatever you want a particular query or mutation to do.

Back to the example......

Open up `src/resolvers/queries.ts`.


Notice the imported `QueryResolvers`. This is part of the magic of the generated typescript. The arguments to the resolvers are now automatically typed correctly

For more info on the args passed to resolvers, the [API docs](https://www.apollographql.com/docs/apollo-server/data/resolvers#resolver-arguments) have a good explanations of the arguments passed to resolvers.

```TS
import { QueryResolvers } from '../generated/resolvers-types'

export const queryResolvers: QueryResolvers = {
  // add a resolver for the current user
  currentUser: async (parent, args, ctx) => {
    return {
      fullName: 'Tylerson Halsteadson',
      emailAddress: 'tylerson.halsteadson@hellodeco.co',
    }
  }
}
```

#### 4. Make a Query
Now you can make queries for the "current user" like with Altair, Graphiql, etc

```graphql
query myCoolQuery {
  currentUser {
    fullName
    emailAddress
  }
}
```




















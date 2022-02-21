import { rule, shield } from 'graphql-shield'

const isAuthenticated = rule()((parent, args, { user }) => {
  return user?.userfrontID
})

const permissions = shield({
  Query: {
    allEmails: isAuthenticated,
  },
})
export default permissions

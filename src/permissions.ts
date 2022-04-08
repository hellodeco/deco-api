import { rule, shield } from 'graphql-shield'

const isAuthenticated = rule()((parent, args, { user }) => {
  return Boolean(user?.userfrontID)
})

// const permissions = shield({
//   Query: {
//     // allEmails: isAuthenticated,
//     // currentUser: isAuthenticated,
//   },
// })

// export default permissions

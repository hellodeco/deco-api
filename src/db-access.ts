import dbConnection from './db-connection'

export function getAllEmails() {
  return dbConnection('emails').select('*')
}

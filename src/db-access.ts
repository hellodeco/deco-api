import dbConnection from './db-connection'

/**
 * @todo type these return values
 */

export function getAllEmails() {
  return dbConnection('emails').select('*')
}

export function getUserMetaByUserfrontID(userfrontID: string) {
  return dbConnection('user_meta')
    .where('userfront_user_id', userfrontID)
    .select('*')
    .first()
}

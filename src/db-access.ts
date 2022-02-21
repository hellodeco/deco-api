import dbConnection from './db-connection'

/**
 * @todo type these return values
 */

export function getAllEmails() {
  return dbConnection('emails').select('*')
}

export function getUserMetaByUserfrontID(userfrontID: string) {
  return dbConnection('user_meta')
    .where('userfront_uuid_id', userfrontID)
    .select('*')
    .first()
}

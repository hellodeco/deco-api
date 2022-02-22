import dbConnection from './db-connection'

/**
 * @todo type these return values
 */

interface DBModel {
  id: number
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

interface UserMeta extends DBModel {
  emailAddress: string
  userfrontUserID: string
  fullName: string
}

export function getAllEmails() {
  return dbConnection('emails').select('*')
}

export function getUserMetaByUserfrontID(userfrontID: string) {
  return dbConnection<UserMeta>('user_meta')
    .where('userfront_user_id', userfrontID)
    .select('*')
    .first()
}

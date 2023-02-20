import { db } from '../db-connection'
import type { User } from '../types/database'

export async function getEmailsSentSince({ ms, user }: { ms: number; user: User }) {
  return db
    .emails()
    .where('user_id', user.id)
    .andWhere('created_at', '>', new Date(Date.now() - ms))
    .andWhereILike('from', `%${user.emailAddress}%`)
    .count('id as count')
    .first() as unknown as { count: string }
}

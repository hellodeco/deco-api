import { getEmailsSentSince } from './db-access/getEmailsSentSince'
import { User } from './types/database'
import {
  EMAIL_SEND_PER_MINUTE_LIMIT,
  EMAIL_SEND_PER_DAY_LIMIT,
  ONE_MINUTE, 
  ONE_DAY,
} from './constants'


/**
 * Given a User object (a database record of the user), returns wether or not the user has reached their daily send limit.
 * The return value is a tuple and if the first value is true, the second will be an error message.
 */
export async function hasUserReachedDailySendLimit({ user }: { user: User }): Promise<[boolean, string]> {
  const sentInLastMinute = await getEmailsSentSince({
    ms: ONE_MINUTE,
    user,
  })
   
  const minuteCount = sentInLastMinute?.count || 0

  if (minuteCount >= EMAIL_SEND_PER_MINUTE_LIMIT) {
    return [true, `You have reached the limit of ${EMAIL_SEND_PER_MINUTE_LIMIT} emails per minute.`]
    // throw new GraphQLError(`You have reached the limit of ${EMAIL_SEND_PER_MINUTE_LIMIT} emails per minute.`)
  }

  const sentInLastDay = await getEmailsSentSince({
    ms: ONE_DAY,
    user,
  })

  const dailyCount = sentInLastDay?.count || 0

  if (dailyCount >= EMAIL_SEND_PER_DAY_LIMIT) {
    return [true, `You have reached the limit of ${EMAIL_SEND_PER_DAY_LIMIT} emails per day.`]
    // throw new GraphQLError(`You have reached the limit of ${EMAIL_SEND_PER_DAY_LIMIT} emails per day.`)
  }

  return [false, '']
}

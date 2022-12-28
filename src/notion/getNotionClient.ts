import { Client } from '@notionhq/client'
import { db } from '../db-connection'
import type { NotionIntegration } from '../types/database'

export async function getNotionClient(userfrontID: string): Promise<Client> {
  let notionIntegration: NotionIntegration
  try {
    notionIntegration = await db
      .notionIntegrations()
      .where('userfront_user_id', userfrontID)
      .select('access_token')
      .first()
  } catch (err) {
    console.error(err)
  }

  if (!notionIntegration) {
    throw new Error(`No notion integration found for user id: ${userfrontID}`)
  }

  return new Client({ auth: notionIntegration.accessToken })
}

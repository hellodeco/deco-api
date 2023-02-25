import { GetPageResponse } from '@notionhq/client/build/src/api-endpoints'

export interface NotionEmailPageProperties {
  Name: {
    title: Array<{
      plain_text: string
    }>
  }
  To: {
    email: string
  }
}

export type NotionEmailPageMetadata = GetPageResponse & { properties: NotionEmailPageProperties }

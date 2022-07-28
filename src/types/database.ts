export enum Tables {
  NOTION_INTEGRATIONS = 'notion_integrations',
  NOTION_DATABASES = 'notion_databases',
  SUBSCRIPTIONS = 'subscriptions',
  USERS = 'users',
  EMAILS = 'emails',
  EMAIL_HEADERS = 'email_headers',
  EMAIL_THREADS = 'email_threads',
  EMAIL_ATTACHMENTS = 'email_attachments',
}

export interface User {
  id?: string
  userfrontUserId: string
  fullName: string
  signupEmail?: string
  emailAddress?: string
  stripeCustomerId?: string
}

export interface DecoDBEmail {
  id: number
  subject: string
  plainTextContent: string
  from: string
  emailThreadId?: number
  htmlContent?: string
  status?: string
  notionPageId?: string
  messageId?: string
  inReplyTo?: string
  references?: string
}

export interface EmailHeader {
  key: string
  value: string
  emailId: number
}

export interface NotionDatabase {
  id?: number
  notionDatabaseId: string
  notionIntegrationId: number
}

export interface Subscription {
  id?: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  subscriptionStatus?: string
  currentPeriodStart?: number
  currentPeriodEnd?: number
  canceledAt?: number
  cancelAtPeriodEnd?: boolean
  stripePriceId?: string
  stripeProductId?: string
  userfrontUserId?: number
}

export interface NotionIntegration {
  id?: number
  userfrontUserId: string
  accessToken: string
  tokenType: string
  workspaceId: string
  workspaceName: string
  workspaceIcon: string
  botId: string
  userId: string
  userFullName: string
  avatarURL: string
  type: string
  email: string
}

export interface EmailThread {
  id?: number
  subject: string
  user_id: number
}

export interface EmailAttachment {
  id?: number
  uuid: string
  filename: string
  encoding: string
  mimetype: string
  userfrontUserId: string
  emailId: number
}

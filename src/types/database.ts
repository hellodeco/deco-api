export enum Tables {
  NOTION_INTEGRATIONS = 'notion_integrations',
  NOTION_DATABASES = 'notion_databases',
  SUBSCRIPTIONS = 'subscriptions',
  USERS = 'users',
  EMAILS = 'emails',
  EMAIL_HEADERS = 'email_headers',
  EMAIL_THREADS = 'email_threads',
  EMAIL_ATTACHMENTS = 'email_attachments',
  EMAIL_ATTACHMENT_TOKENS = 'email_attachment_tokens',
}

export interface User {
  id?: string
  userfrontUserId: string
  fullName?: string
  signupEmail?: string
  emailAddress?: string
  stripeCustomerId?: string
}

export interface DecoDBEmail {
  id: number
  createdAt: string
  subject: string
  plainTextContent: string
  from: string
  uuid: string
  userId?: number
  emailThreadId?: number
  htmlContent?: string
  status?: EmailStatus
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

export enum NotionDatabaseType {
  EMAIL = 'EMAIL',
  CONTACTS = 'CONTACTS',
}
export interface NotionDatabase {
  id?: number
  notionDatabaseId: string
  notionIntegrationId: number
  type?: NotionDatabaseType
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
  userfrontUserId?: string
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

export interface EmailAttachmentTokens {
  id?: number
  deletedAt?: string
  createdAt: string
  updatedAt: string
  attachmentId: number
  token: string
}

export enum EmailStatus {
  // a generic status that means the email has been received by us, but not made it to Notion yet
  RECEIVED_TO_DECO = 'RECEIVED_TO_DECO',
  // received by us and no "to" address was found in our database
  RECEIVED_TO_DECO__TO_ADDRESS_NOT_FOUND = 'RECEIVED_TO_DECO__TO_ADDRESS_NOT_FOUND',
  // received by us and the user has reached their free tier limit and has no active subscription
  RECEIVED_TO_DECO__FREE_TIER_LIMIT_EXCEEDED = 'RECEIVED_TO_DECO__FREE_TIER_LIMIT_EXCEEDED',
  // received by us but there was a problem when importing to Notion
  RECEIVED_TO_DECO__NOTION_IMPORT_FAILED = 'RECEIVED_TO_DECO__NOTION_IMPORT_FAILED',
  // a generic status that means the email has been received by us and successfully made it to Notion
  RECEIVED_TO_NOTION = 'RECEIVED_TO_NOTION',
}

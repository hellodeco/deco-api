import { attachPaginate } from 'knex-paginate'
import { db } from '../db-connection'
import { addEmailToNotion } from '../notion/notion'
import { EmailStatus } from '../constants'
import { getNotionClient } from '../notion/getNotionClient'
import type { DecoDBEmail } from '../types/database'

attachPaginate()

interface PaginateQueryOpts {
  currentPage?: number
  perPage?: number
  timeLimit: string
}

const userIdToUserfrontId = {}

async function getUserfrontIdFromUserId(userId: number) {
  if (userIdToUserfrontId[userId]) {
    return userIdToUserfrontId[userId]
  }

  const user = await db.users().where('id', userId).first()

  userIdToUserfrontId[userId] = user.userfrontUserId

  return user.userfrontUserId
}

async function paginatedQuery({
  currentPage = 1,
  perPage = 10,
  timeLimit,
}: PaginateQueryOpts) {
  return db
    .emails()
    .select('*')
    .where('status', EmailStatus.RECEIVED_TO_DECO)
    .where('created_at', '>', timeLimit)
    .paginate({
      perPage,
      currentPage,
      isLengthAware: true,
    })
}

async function gentlyPlaceEmailIntoNotion(email: DecoDBEmail) {
  console.log(`processing email: ${email.id} with status: ${email.status}`)

  const userfrontID = await getUserfrontIdFromUserId(email.userId)

  const attachments = await db
    .emailAttachments()
    .select('*')
    .where('email_id', email.id)

  const notionClient = await getNotionClient(userfrontID)

  const notionResp = await addEmailToNotion({
    newEmail: {
      subject: email.subject,
      from: email.from,
      emailId: email.id,
      emailThreadId: email.emailThreadId,
      plainTextContent: email.plainTextContent,
      htmlContent: email.htmlContent,
      createdAt: email.createdAt,
    },
    userfrontID,
    attachments,
    notionClient,
  })

  if (!notionResp?.pageId) {
    console.log(`Failed to add email with id ${email.id} to notion`)
    return
  }

  console.log(
    `Successfully added email with id ${email.id} to notion`,
    notionResp?.pageId,
  )

  await db.emails().where('id', email.id).update({
    status: EmailStatus.RECEIVED_TO_NOTION,
  })
}

async function main() {
  const timeLimit = process.env.CREATED_AT_LIMIT

  if (!timeLimit) {
    console.error(
      `Please set the "CREATED_AT_LIMIT" environment variable to limit how far back you want to check for emails. e.g. CREATED_AT_LIMIT="2021-12-31"`,
    )
    process.exit(1)
  }

  let lastPage = 1
  let currentPage = 1

  while (currentPage <= lastPage) {
    const nextDataRes = await paginatedQuery({
      currentPage,
      timeLimit,
    })

    const { data, pagination } = nextDataRes

    lastPage = pagination.lastPage

    const promises = []

    for (let email of data) {
      const updatePromise = gentlyPlaceEmailIntoNotion(email)

      promises.push(updatePromise)
    }

    await Promise.all(promises)

    currentPage++
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .then(() => {
    process.exit(0)
  })

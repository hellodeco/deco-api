import { attachPaginate } from 'knex-paginate'
import { db } from '../db-connection';
import { addEmailToNotion } from '../notion/notion';
import { EmailStatus } from '../constants'
import type { DecoDBEmail } from '../types/database';

attachPaginate()

interface PaginateQueryOpts {
  currentPage?: number
  perPage?: number
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

async function paginatedQuery({ currentPage = 1, perPage = 10 }: PaginateQueryOpts){
  return db
    .emails()
    .select('*')
    .where('status', EmailStatus.RECEIVED_TO_DECO)
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
  })

  if (!notionResp?.pageId) {
    console.log(`Failed to add email with id ${email.id} to notion`,)
    return
  }

  console.log(`Successfully added email with id ${email.id} to notion`, notionResp?.pageId)

  await db
    .emails()
    .where('id', email.id)
    .update({
      status: EmailStatus.RECEIVED_TO_NOTION,
    })
}

async function main() {
  let lastPage = 1
  let currentPage = 1

  while (currentPage <= lastPage) {
    const nextDataRes = await paginatedQuery({
      currentPage,
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

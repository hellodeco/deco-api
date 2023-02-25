import { NotionEmailPageMetadata } from '../types/notion'

export function getEmailSubjectFromPageMetadata({
  metadata,
  defaultSubject,
}: { metadata:NotionEmailPageMetadata, defaultSubject: string }): string {
  let subject = metadata?.properties?.Name?.title
    ?.map((title) => title.plain_text)
    .join('')

  if (!subject) {
    subject = defaultSubject
  }

  return subject
}

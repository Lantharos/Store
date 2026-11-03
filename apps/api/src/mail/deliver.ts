import type { Pult } from "@lantharos/pult"
import { eq } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { mail as mailInbox } from "../ops/define/mail.ts"
import type { Mailbox } from "./addresses.ts"
import { acknowledge } from "./send.ts"
import { attachmentsOf, readStored } from "./stored.ts"

export type MailRow = typeof schema.mail.$inferSelect

async function deliveredTo(row: MailRow, item: string) {
  await db.update(schema.mail).set({ pultItem: item }).where(eq(schema.mail.id, row.id))
}

type Stored = NonNullable<Awaited<ReturnType<typeof readStored>>>

export async function deliverMail(pult: Pult, row: MailRow, given?: Stored) {
  const stored = given ?? (row.rawKey ? await readStored(row.rawKey) : null)
  if (!stored) return
  const { mail, raw } = stored
  const mailbox = row.mailbox as Mailbox
  const received =
    row.thread &&
    (await pult.receive({
      thread: row.thread,
      from: mail.from,
      subject: mail.subject,
      text: mail.text,
      attachments: attachmentsOf(mail, raw),
    }))
  if (received) return deliveredTo(row, received.item)
  const sent = await pult.send(mailInbox, {
    fingerprint: row.messageId ?? row.id,
    tags: [mailbox, ...row.tags],
    data: {
      mailbox,
      from: mail.from,
      name: mail.name,
      replyTo: mail.replyTo,
      subject: mail.subject.slice(0, 300),
      text: mail.text,
      raw: row.rawKey!,
    },
  })
  await deliveredTo(row, sent.id)
  if (row.acknowledge) await acknowledge(mailbox, sent.id, mail.from, mail.subject)
}

import { env } from "cloudflare:workers"
import { db, schema } from "../db/client.ts"
import { randomId } from "../lib/ids.ts"
import { addressOf, type Mailbox } from "./addresses.ts"
import { bareMessageId } from "./parse.ts"
import { threadingHeaders } from "./threads.ts"

interface Outgoing {
  mailbox: Mailbox
  thread: string
  to: string
  subject: string
  text: string
}

export async function sendMail({ mailbox, thread, to, subject, text }: Outgoing, automatic = false) {
  const sent = await env.EMAIL.send({
    from: { name: "Schelf", email: addressOf(mailbox) },
    replyTo: addressOf(mailbox, thread),
    to,
    subject,
    text,
    headers: {
      ...(await threadingHeaders(thread)),
      ...(automatic ? { "Auto-Submitted": "auto-replied" } : {}),
    },
  })
  await db.insert(schema.mail).values({
    id: randomId(),
    direction: "out",
    mailbox,
    messageId: bareMessageId(sent.messageId),
    pultItem: thread,
  })
}

export function acknowledge(mailbox: Mailbox, thread: string, to: string, subject: string) {
  return sendMail(
    {
      mailbox,
      thread,
      to,
      subject: subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject || "your message"}`,
      text:
        `We received your message to ${addressOf(mailbox)}, and a person will read it. ` +
        "If it's a notice about something on Schelf, we'll write to you with what we decided and why.\n\n" +
        "To add anything, reply to this email and it stays with your message.",
    },
    true,
  )
}

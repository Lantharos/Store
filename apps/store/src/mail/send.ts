import { env } from "cloudflare:workers"
import { db, schema } from "../db/client.ts"
import { randomId } from "../lib/ids.ts"
import { addressOf, type Mailbox } from "./addresses.ts"
import { type Mail, renderHtml, renderText } from "./notices/render.ts"
import { bareMessageId } from "./parse.ts"
import { threadingHeaders } from "./threads.ts"

interface Conversation {
  mailbox: Mailbox
  thread: string
  to: string
}

interface Outgoing extends Conversation {
  subject: string
  text: string
  html?: string
  automatic?: boolean
}

export async function sendMail({ mailbox, thread, to, subject, text, html, automatic }: Outgoing) {
  const sent = await env.EMAIL.send({
    from: { name: "Schelf", email: addressOf(mailbox) },
    replyTo: addressOf(mailbox, thread),
    to,
    subject,
    text,
    ...(html && { html }),
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

export function sendDesigned(conversation: Conversation, mail: Mail, automatic = false) {
  return sendMail({
    ...conversation,
    subject: mail.subject,
    text: renderText(mail),
    html: renderHtml(mail),
    automatic,
  })
}

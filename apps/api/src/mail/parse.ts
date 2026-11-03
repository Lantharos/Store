import PostalMime, { type Address, type Email } from "postal-mime"

export const TEXT_LIMIT = 20_000

export interface MailFile {
  name: string
  contentType: string
  data: Uint8Array
}

export interface Mail {
  from: string
  name: string | null
  replyTo: string | null
  subject: string
  text: string
  messageId: string | null
  references: string[]
  headers: Email["headers"]
  files: MailFile[]
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }

export function textOfHtml(html: string) {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (entity, code: string) => {
      if (code.startsWith("#x")) return String.fromCodePoint(Number.parseInt(code.slice(2), 16))
      if (code.startsWith("#")) return String.fromCodePoint(Number(code.slice(1)))
      return ENTITIES[code.toLowerCase()] ?? entity
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function messageIds(value: string | undefined) {
  return [...(value ?? "").matchAll(/<([^<>\s]+)>/g)].map((match) => match[1]!)
}

export function bareMessageId(value: string) {
  return value.trim().replace(/^<|>$/g, "")
}

function mailboxOf(address: Address | undefined) {
  return address?.address ? address : address?.group?.[0]
}

function bytesOf(content: ArrayBuffer | Uint8Array | string) {
  return typeof content === "string" ? new TextEncoder().encode(content) : new Uint8Array(content)
}

export async function readMail(raw: ArrayBuffer): Promise<Mail> {
  const email = await PostalMime.parse(raw, { attachmentEncoding: "arraybuffer" })
  const from = mailboxOf(email.from)
  const text = email.text?.trim() || textOfHtml(email.html ?? "")
  return {
    from: from?.address?.toLowerCase() ?? "",
    name: from?.name || null,
    replyTo: mailboxOf(email.replyTo?.[0])?.address?.toLowerCase() || null,
    subject: email.subject?.trim() ?? "",
    text: text.slice(0, TEXT_LIMIT),
    messageId: email.messageId ? bareMessageId(email.messageId) : null,
    references: [...new Set([...messageIds(email.inReplyTo), ...messageIds(email.references)])],
    headers: email.headers,
    files: email.attachments
      .filter((attachment) => !attachment.related)
      .map((attachment, index) => ({
        name: attachment.filename || `attachment-${index + 1}`,
        contentType: attachment.mimeType,
        data: bytesOf(attachment.content),
      })),
  }
}

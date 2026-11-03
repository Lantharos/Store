export const MAIL_DOMAIN = "schelf.store"

export const MAILBOXES = ["legal", "dmca", "abuse", "security", "privacy", "support", "hello"] as const

export type Mailbox = (typeof MAILBOXES)[number]

export const ACKNOWLEDGED: readonly Mailbox[] = ["legal", "dmca"]

export function isMailbox(name: string): name is Mailbox {
  return (MAILBOXES as readonly string[]).includes(name)
}

export function addressOf(mailbox: Mailbox, thread?: string) {
  return `${thread ? `${mailbox}+${thread}` : mailbox}@${MAIL_DOMAIN}`
}

export function recipientOf(address: string) {
  const [local, domain] = address.toLowerCase().split("@")
  if (domain !== MAIL_DOMAIN || !local) return null
  const [name = "", thread] = local.split("+", 2)
  return { name, thread: thread && /^[a-z0-9]+$/.test(thread) ? thread : null }
}

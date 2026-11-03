import { b, inbox, noul, setState, triage } from "@lantharos/pult"
import { z } from "zod"
import { addressOf, MAILBOXES } from "../../mail/addresses.ts"
import { sendMail } from "../../mail/send.ts"
import { attachmentsOf, readStored } from "../../mail/stored.ts"

const INSTRUCTIONS =
  "Each item is an email sent to one of schelf.store's addresses, such as legal, privacy, security or support. " +
  "schelf.store is an app store for Linux, Windows and macOS. Legal notices, takedown requests and security reports " +
  "matter even when they're badly written; only close what is plainly unsolicited advertising, phishing or spam."

export const mail = inbox("mail", {
  icon: "mail",
  states: ["open", "handled", "spam"],
  closed: ["handled", "spam"],
  sla: { open: "2d" },
  data: z.object({
    mailbox: z.enum(MAILBOXES),
    from: z.string(),
    name: z.string().nullable(),
    replyTo: z.string().nullable(),
    subject: z.string(),
    text: z.string(),
    raw: z.string(),
  }),
  title: (data) => data.subject || `No subject, from ${data.name ?? "someone"}`,
  triage: triage({
    instructions: INSTRUCTIONS,
    questions: { spam: noul("Is this unsolicited advertising, phishing or spam?") },
    rules: [{ name: "Close spam", when: (answers) => answers.spam > 0.95, then: setState("spam") }],
  }),
  reply: {
    to: (item) => item.data.replyTo ?? item.data.from,
    send: ({ item, to, subject, text, thread }) =>
      sendMail({ mailbox: item.data.mailbox, thread, to, subject, text }),
  },
  render: async (item) => {
    const stored = await readStored(item.data.raw)
    return [
      b.fields({
        to: addressOf(item.data.mailbox),
        from: item.data.name ?? undefined,
        email: b.sensitive(item.data.from),
        "reply to":
          item.data.replyTo && item.data.replyTo !== item.data.from
            ? b.sensitive(item.data.replyTo)
            : undefined,
      }),
      b.markdown(item.data.text || "_No text_"),
      ...(stored ? attachmentsOf(stored.mail, stored.raw) : []),
    ]
  },
})

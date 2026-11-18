import { addressOf, type Mailbox } from "../../addresses.ts"
import { paragraph } from "../parts.ts"
import type { Mail } from "../render.ts"

export function mailReceived({ mailbox, subject }: { mailbox: Mailbox; subject: string }): Mail {
  return {
    subject: subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject || "your message"}`,
    preview: "A person will read it.",
    heading: "We received your message",
    body: [
      paragraph(
        "A person will read it. If it's a notice about something on Schelf, we'll write to you with what we decided and why.",
      ),
      paragraph("To add anything, reply to this email and it stays with your message."),
    ],
    reason: `You got this because you wrote to ${addressOf(mailbox)}.`,
  }
}

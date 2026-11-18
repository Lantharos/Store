import { env, waitUntil } from "cloudflare:workers"
import { type Mail, renderHtml, renderText } from "./render.ts"

export function compose(to: string, mail: Mail): EmailMessageBuilder {
  return {
    from: { name: "Schelf", email: env.NOTIFY_FROM },
    to,
    subject: mail.subject,
    ...(mail.replyTo && { replyTo: mail.replyTo }),
    html: renderHtml(mail),
    text: renderText(mail),
  }
}

export function sendNotice(to: string, mail: Mail) {
  return env.EMAIL.send(compose(to, mail))
}

export function queueNotice(to: string, mail: Mail) {
  waitUntil(sendNotice(to, mail))
}

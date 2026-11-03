import { env, waitUntil } from "cloudflare:workers"

export function confirmReport(email: string, app: string, id: string) {
  waitUntil(
    env.EMAIL.send({
      from: env.NOTIFY_FROM,
      to: email,
      subject: `We received your report about ${app}`,
      text: `Thanks for telling us. A person will look at your report about ${app} and decide what to do; we'll write to you when they have.\n\nYour reference is ${id}.`,
    }),
  )
}

import { env, waitUntil } from "cloudflare:workers"

export const CODE_MINUTES = 10

export function sendCode({ email, otp }: { email: string; otp: string }) {
  waitUntil(
    env.EMAIL.send({
      from: env.NOTIFY_FROM,
      to: email,
      subject: `${otp} is your Schelf code`,
      text: `Your code to sign in to schelf.store as ${email}:\n\n${otp}\n\nIt works for ${CODE_MINUTES} minutes. If you didn't ask for it, you can ignore this email.`,
    }),
  )
}

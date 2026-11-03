import { code, paragraph } from "../parts.ts"
import type { Mail } from "../render.ts"

export function signInCode({ email, otp, minutes }: { email: string; otp: string; minutes: number }): Mail {
  return {
    subject: `${otp} is your Schelf sign-in code`,
    preview: `It works for ${minutes} minutes.`,
    heading: "Your sign-in code",
    body: [
      paragraph(`Enter this code on schelf.store to sign in as ${email}.`),
      code(otp),
      paragraph(`It works for ${minutes} minutes. If you didn't try to sign in, you can ignore this email.`),
    ],
    reason: "You got this because someone asked to sign in to Schelf with this address.",
  }
}

export function contactCode({
  email,
  publisher,
  otp,
  minutes,
}: {
  email: string
  publisher: string
  otp: string
  minutes: number
}): Mail {
  return {
    subject: `${otp} confirms your address for ${publisher}`,
    preview: `Enter it on schelf.store to confirm ${email}.`,
    heading: "Confirm your contact address",
    body: [
      paragraph(
        `Enter this code on schelf.store to confirm ${email} as the contact for verifying ${publisher}.`,
      ),
      code(otp),
      paragraph(`It works for ${minutes} minutes. If you didn't expect it, you can ignore this email.`),
    ],
    reason: `You got this because this address was given as the contact for verifying ${publisher} on Schelf.`,
  }
}

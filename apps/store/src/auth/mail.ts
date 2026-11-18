import { queueNotice } from "../mail/notices/send.ts"
import { signInCode } from "../mail/notices/templates/codes.ts"

export const CODE_MINUTES = 10

export function sendCode({ email, otp }: { email: string; otp: string }) {
  queueNotice(email, signInCode({ email, otp, minutes: CODE_MINUTES }))
}

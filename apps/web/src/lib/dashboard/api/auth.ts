import { passkeyClient } from "@better-auth/passkey/client"
import { createAuthClient } from "better-auth/client"
import { deviceAuthorizationClient, emailOTPClient } from "better-auth/client/plugins"

export const auth = createAuthClient({
  baseURL: location.origin,
  basePath: "/api/auth",
  plugins: [passkeyClient(), emailOTPClient(), deviceAuthorizationClient()],
})

export const CODE_LENGTH = 6

const message = (error: { message?: string } | null, fallback: string) =>
  error ? (error.message ?? fallback) : null

export async function sendCode(email: string) {
  const result = await auth.emailOtp.sendVerificationOtp({ email, type: "sign-in" })
  return message(result.error, "We couldn't send a code to that address.")
}

export async function signInWithCode(email: string, code: string) {
  const result = await auth.signIn.emailOtp({ email, otp: code })
  return message(result.error, "That code didn't work.")
}

export async function signInWithPasskey() {
  const result = await auth.signIn.passkey()
  return message(result?.error ?? null, "That passkey didn't work.")
}

export function signInWithGitHub(next: string) {
  return auth.signIn.social({ provider: "github", callbackURL: next })
}

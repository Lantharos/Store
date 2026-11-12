import { env } from "cloudflare:workers"
import { passkey } from "@better-auth/passkey"
import { CLI_CLIENT_ID } from "@schelf/protocol"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { APIError } from "better-auth/api"
import { bearer, deviceAuthorization, emailOTP } from "better-auth/plugins"
import { HTTPException } from "hono/http-exception"
import { forgetUploadedAvatar } from "../avatars/stored.ts"
import { db, schema } from "../db/client.ts"
import { releaseOwnerships } from "../publishers/ownership.ts"
import { CODE_MINUTES, sendCode } from "./mail.ts"

const publicUrl = new URL(env.PUBLIC_URL)

export type Via = "browser" | "passkey" | "cli"

function viaOf(path: string | undefined): Via {
  if (path === "/device/token") return "cli"
  return path === "/passkey/verify-authentication" ? "passkey" : "browser"
}
const SESSION_CACHE_SECONDS = 5 * 60

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: publicUrl.origin,
  basePath: "/api/auth",
  trustedOrigins: [publicUrl.origin],
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  session: {
    cookieCache: { enabled: true, maxAge: SESSION_CACHE_SECONDS },
    additionalFields: { via: { type: "string", required: false, input: false } },
  },
  databaseHooks: {
    session: {
      create: { before: async (session, context) => ({ data: { ...session, via: viaOf(context?.path) } }) },
    },
  },
  account: { accountLinking: { enabled: true, trustedProviders: ["github"] } },
  user: {
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        try {
          await releaseOwnerships(user.id)
          await forgetUploadedAvatar(user.id)
        } catch (error) {
          if (error instanceof HTTPException) throw new APIError("CONFLICT", { message: error.message })
          throw error
        }
      },
    },
  },
  socialProviders: {
    github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET, scope: ["read:org"] },
  },
  plugins: [
    passkey({ rpID: publicUrl.hostname, rpName: "Schelf", origin: publicUrl.origin }),
    emailOTP({
      expiresIn: CODE_MINUTES * 60,
      storeOTP: "hashed",
      sendVerificationOTP: async (data) => sendCode(data),
    }),
    deviceAuthorization({
      expiresIn: "10m",
      interval: "5s",
      verificationUri: `${publicUrl.origin}/device`,
      validateClient: (clientId) => clientId === CLI_CLIENT_ID,
    }),
    bearer(),
  ],
  telemetry: { enabled: false },
})

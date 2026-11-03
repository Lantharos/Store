import { env } from "cloudflare:workers"
import { addressOf } from "../addresses.ts"

export const SUPPORT: EmailAddress = { name: "Schelf Support", email: addressOf("support") }

export const link = (path: string) => `${env.PUBLIC_URL}${path}`

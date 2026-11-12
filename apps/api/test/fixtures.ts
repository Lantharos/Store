import { exports } from "cloudflare:workers"
import { DEFAULT_LOCALE, type Format, sha256Hex, TOKEN_PREFIX, utf8 } from "@schelf/protocol"
import { expect } from "vitest"
import { db, schema } from "../src/db/client.ts"
import { randomId } from "../src/lib/ids.ts"

export async function publisherWithApp(format: Format = "appimage") {
  const suffix = randomId(6)
  const userId = randomId()
  const publisherId = randomId()
  const prefix = `com.example${suffix}`
  const appId = `${prefix}.Notes`
  const token = `${TOKEN_PREFIX}${randomId(32)}`
  const now = new Date()
  await db.batch([
    db.insert(schema.user).values({ id: userId, name: "Mira", email: `mira-${suffix}@example.com` }),
    db.insert(schema.publisher).values({
      id: publisherId,
      ownerId: userId,
      name: `Mira ${suffix}`,
      slug: `mira-${suffix}`,
      kind: "person",
      agreementVersion: "2026-11",
      agreementAt: now,
    }),
    db.insert(schema.member).values({ publisherId, userId, role: "owner" }),
    db
      .insert(schema.namespace)
      .values({ prefix, publisherId, proof: "dns", proofValue: "x", verifiedAt: now, checkedAt: now }),
    db.insert(schema.app).values({
      id: appId,
      slug: "notes",
      publisherId,
      kind: format === "luft-extension" ? "extension" : "app",
      format,
      updater: format === "sabine" ? "sabine" : null,
      repository: "mira/notes",
      repositoryId: "123",
    }),
    db.insert(schema.listing).values({
      appId,
      locale: DEFAULT_LOCALE,
      name: `Notes ${suffix}`,
      summary: "Notes that stay out of the way",
      description: "Write things down.",
    }),
    db.insert(schema.listingMeta).values({ appId, categories: ["Office"] }),
    db.insert(schema.token).values({
      id: randomId(),
      appId,
      publisherId,
      hash: await sha256Hex(token),
      name: "laptop",
      expiresAt: new Date(now.getTime() + 86_400_000),
    }),
  ])
  return { appId, publisherId, publisherSlug: `mira-${suffix}`, userId, token }
}

export function schelfToml(appId: string, format = "appimage") {
  return `id = "${appId}"\nformat = "${format}"\npermissions = "permissions.toml"\n`
}

export function bytesOf(text: string) {
  return utf8(text)
}

const DEV = "https://schelf.store/api/v1/dev"

export interface Person {
  id: string
  email: string
  token: string
  call: (method: string, path: string, body?: unknown) => Promise<Response>
}

type Via = "browser" | "passkey" | "cli"

export async function person(name: string, existing?: string, via: Via = "browser"): Promise<Person> {
  const id = existing ?? randomId()
  const token = randomId(32)
  const email = `${name.toLowerCase()}-${id}@example.com`
  const session = db
    .insert(schema.session)
    .values({ id: randomId(), token, userId: id, via, expiresAt: new Date(Date.now() + 3_600_000) })
  if (existing) await session
  else await db.batch([db.insert(schema.user).values({ id, name, email, emailVerified: true }), session])
  return {
    id,
    email,
    token,
    call: (method, path, body) =>
      exports.default.fetch(
        new Request(`${DEV}${path}`, {
          method,
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
      ),
  }
}

export async function json<T>(response: Response) {
  expect(response.status).toBeLessThan(300)
  return (await response.json()) as T
}

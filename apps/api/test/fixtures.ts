import { DEFAULT_LOCALE, type Format, sha256Hex, TOKEN_PREFIX, utf8 } from "@schelf/protocol"
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

import { applyD1Migrations } from "cloudflare:test"
import { env } from "cloudflare:workers"
import { describe, expect, test } from "vitest"

const BEFORE_ORGANISATIONS = 5
const BEFORE_HOSTING = 9

async function rows<T>(query: string, db = env.MIGRATION_DB) {
  return (await db.prepare(query).all<T>()).results
}

describe("the organisations migration", () => {
  test("turns a developer into an organisation its account owns, with a personal publisher beside it", async () => {
    const db = env.MIGRATION_DB
    await applyD1Migrations(db, env.TEST_MIGRATIONS.slice(0, BEFORE_ORGANISATIONS))
    await db.batch([
      db.prepare(
        "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES ('owner', 'Mira Halvorsen', 'mira@example.com', 1, 1, 1)",
      ),
      db.prepare(
        "INSERT INTO developer (id, user_id, name, slug, kind, github_login, agreement_version, agreement_at, status, created_at) VALUES ('studio', 'owner', 'Studio', 'studio', 'organisation', 'studio', '2026-11', 1, 'active', 1)",
      ),
      db.prepare(
        "INSERT INTO namespace (prefix, developer_id, proof, proof_value, verified_at, checked_at, created_at) VALUES ('com.studio', 'studio', 'dns', 'x', 1, 1, 1)",
      ),
      db.prepare(
        "INSERT INTO app (id, developer_id, kind, format, status, created_at) VALUES ('com.studio.Notes', 'studio', 'app', 'sabine', 'listed', 1)",
      ),
      db.prepare(
        "INSERT INTO listing (app_id, locale, name, summary) VALUES ('com.studio.Notes', 'en', 'Notes', 'Notes')",
      ),
      db.prepare(
        "INSERT INTO release (id, app_id, version, origin, manifest, requires, status, created_at) VALUES ('r1', 'com.studio.Notes', '1.0.0', 'oidc', '', '{}', 'live', 1)",
      ),
      db.prepare(
        "INSERT INTO token (id, app_id, developer_id, hash, name, expires_at, created_at) VALUES ('t1', 'com.studio.Notes', 'studio', 'h', 'laptop', 9, 1)",
      ),
    ])
    await applyD1Migrations(db, env.TEST_MIGRATIONS)

    expect(await rows("SELECT id, kind, owner_id, name, slug FROM publisher ORDER BY kind")).toEqual([
      { id: "studio", kind: "organisation", owner_id: "owner", name: "Studio", slug: "studio" },
      {
        id: expect.any(String),
        kind: "person",
        owner_id: "owner",
        name: "Mira Halvorsen",
        slug: "mira-halvorsen",
      },
    ])
    expect(await rows("SELECT role FROM member WHERE user_id = 'owner'")).toEqual([
      { role: "owner" },
      { role: "owner" },
    ])
    expect(await rows("SELECT publisher_id FROM app")).toEqual([{ publisher_id: "studio" }])
    expect(await rows("SELECT publisher_id FROM namespace")).toEqual([{ publisher_id: "studio" }])
    expect(await rows("SELECT publisher_id FROM token")).toEqual([{ publisher_id: "studio" }])
    expect(await rows("SELECT count(*) AS listings FROM listing")).toEqual([{ listings: 1 }])
    expect(await rows("SELECT count(*) AS releases FROM release")).toEqual([{ releases: 1 }])
    expect(await rows("PRAGMA foreign_key_check")).toEqual([])
  })
})

describe("the hosting migration", () => {
  test("names every app by the end of its id, marks them published and gives Sabine apps their updater", async () => {
    const db = env.HOSTING_MIGRATION_DB
    await applyD1Migrations(db, env.TEST_MIGRATIONS.slice(0, BEFORE_HOSTING))
    await db.batch([
      db.prepare(
        "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES ('owner', 'Mira', 'mira@example.com', 1, 1, 1)",
      ),
      db.prepare(
        "INSERT INTO publisher (id, kind, owner_id, name, slug, agreement_version, agreement_at, created_at) VALUES ('lantharos', 'organisation', 'owner', 'Lantharos', 'lantharos', '2026-11', 1, 1)",
      ),
      db.prepare(
        "INSERT INTO app (id, publisher_id, kind, format, status, created_at) VALUES ('com.lantharos.Rain', 'lantharos', 'extension', 'luft-extension', 'listed', 1), ('com.lantharos.draft', 'lantharos', 'app', 'sabine', 'listed', 1)",
      ),
      db.prepare(
        "INSERT INTO release (id, app_id, version, origin, manifest, requires, status, created_at) VALUES ('r1', 'com.lantharos.draft', '1.0.0', 'token', '', '{}', 'live', 1)",
      ),
    ])
    await applyD1Migrations(db, env.TEST_MIGRATIONS)

    expect(await rows("SELECT id, slug, status, visibility, updater FROM app ORDER BY id", db)).toEqual([
      { id: "com.lantharos.Rain", slug: "rain", status: "published", visibility: "listed", updater: null },
      {
        id: "com.lantharos.draft",
        slug: "draft",
        status: "published",
        visibility: "listed",
        updater: "sabine",
      },
    ])
    expect(await rows("SELECT origin, format, updater, channel FROM release", db)).toEqual([
      { origin: "manual", format: "sabine", updater: "sabine", channel: "stable" },
    ])
  })
})

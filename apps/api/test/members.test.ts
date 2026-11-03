import { exports } from "cloudflare:workers"
import { type Account, AGREEMENT_VERSION, type DashboardPublisher, type Members } from "@schelf/protocol"
import { eq } from "drizzle-orm"
import { describe, expect, test } from "vitest"
import { db, schema } from "../src/db/client.ts"
import { randomId } from "../src/lib/ids.ts"
import { releaseOwnerships } from "../src/publishers/ownership.ts"
import { publisherWithApp } from "./fixtures.ts"

const DEV = "https://schelf.store/api/v1/dev"

interface Person {
  id: string
  email: string
  call: (method: string, path: string, body?: unknown) => Promise<Response>
}

async function person(name: string): Promise<Person> {
  const id = randomId()
  const token = randomId(32)
  const email = `${name.toLowerCase()}-${id}@example.com`
  await db.batch([
    db.insert(schema.user).values({ id, name, email, emailVerified: true }),
    db
      .insert(schema.session)
      .values({ id: randomId(), token, userId: id, expiresAt: new Date(Date.now() + 3_600_000) }),
  ])
  return {
    id,
    email,
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

async function json<T>(response: Response) {
  expect(response.status).toBeLessThan(300)
  return (await response.json()) as T
}

async function join(owner: Person, org: string, member: Person, role: "admin" | "developer" | "owner") {
  await json(await owner.call("POST", `/publishers/${org}/invites`, { email: member.email, role }))
  const account = await json<Account>(await member.call("GET", "/account"))
  const invite = account.invites.find((entry) => entry.role === role)!
  await json(await member.call("POST", `/invites/${invite.id}/accept`))
}

async function team() {
  const [alice, carol, bob] = await Promise.all([person("Alice"), person("Carol"), person("Bob")])
  const org = await json<DashboardPublisher>(
    await alice.call("POST", "/publishers", {
      kind: "organisation",
      name: "Kaleidal",
      agreement: AGREEMENT_VERSION,
    }),
  )
  await join(alice, org.id, carol, "admin")
  await join(alice, org.id, bob, "developer")
  return { alice, carol, bob, org: org.id }
}

async function roles(viewer: Person, org: string) {
  const { members } = await json<Members>(await viewer.call("GET", `/publishers/${org}/members`))
  return Object.fromEntries(members.map((member) => [member.name, member.role]))
}

describe("organisation roles", () => {
  test("developers manage releases and listings, not apps or people", async () => {
    const { bob, org } = await team()
    const { appId } = await publisherWithApp()
    await db.update(schema.app).set({ publisherId: org }).where(eq(schema.app.id, appId))
    expect(
      (
        await bob.call("PUT", `/apps/${appId}/listing/en`, {
          name: "Notes",
          summary: "Notes that stay out of the way",
          description: "",
          keywords: [],
        })
      ).status,
    ).toBe(200)
    expect((await bob.call("POST", `/apps/${appId}/tokens`, { name: "laptop" })).status).toBe(403)
    expect(
      (await bob.call("POST", `/publishers/${org}/invites`, { email: "dee@example.com", role: "developer" }))
        .status,
    ).toBe(403)
    expect((await bob.call("PATCH", `/publishers/${org}`, { name: "Renamed" })).status).toBe(403)
  })

  test("admins manage people but can't touch owners", async () => {
    const { alice, carol, bob, org } = await team()
    expect(
      (await carol.call("POST", `/publishers/${org}/invites`, { github: "dee", role: "developer" })).status,
    ).toBe(201)
    expect(
      (await carol.call("POST", `/publishers/${org}/invites`, { github: "eve", role: "owner" })).status,
    ).toBe(403)
    expect(
      (await carol.call("PATCH", `/publishers/${org}/members/${alice.id}`, { role: "admin" })).status,
    ).toBe(403)
    expect((await carol.call("DELETE", `/publishers/${org}/members/${alice.id}`)).status).toBe(403)
    expect(
      (await carol.call("PATCH", `/publishers/${org}/members/${bob.id}`, { role: "admin" })).status,
    ).toBe(204)
    expect(await roles(alice, org)).toEqual({ Alice: "owner", Carol: "admin", Bob: "admin" })
  })

  test("someone outside the organisation sees nothing of it", async () => {
    const { org } = await team()
    const stranger = await person("Mallory")
    expect((await stranger.call("GET", `/publishers/${org}/members`)).status).toBe(404)
  })
})

describe("the last owner", () => {
  test("can't step down, leave or delete their account while others depend on them", async () => {
    const { alice, org } = await team()
    expect(
      (await alice.call("PATCH", `/publishers/${org}/members/${alice.id}`, { role: "admin" })).status,
    ).toBe(409)
    expect((await alice.call("DELETE", `/publishers/${org}/members/${alice.id}`)).status).toBe(409)
    await expect(releaseOwnerships(alice.id)).rejects.toThrow("Make someone else an owner of Kaleidal")
  })

  test("hands over by transferring ownership, and can leave afterwards", async () => {
    const { alice, carol, org } = await team()
    expect((await alice.call("POST", `/publishers/${org}/members/${carol.id}/transfer`)).status).toBe(204)
    expect(await roles(carol, org)).toEqual({ Alice: "admin", Carol: "owner", Bob: "developer" })
    const contact = await db.query.publisher.findFirst({ where: eq(schema.publisher.id, org) })
    expect(contact?.ownerId).toBe(carol.id)
    expect((await alice.call("DELETE", `/publishers/${org}/members/${alice.id}`)).status).toBe(204)
    expect((await carol.call("DELETE", `/publishers/${org}/members/${carol.id}`)).status).toBe(409)
  })

  test("with a second owner, either can step down and the other becomes the contact", async () => {
    const { alice, carol, org } = await team()
    expect(
      (await alice.call("PATCH", `/publishers/${org}/members/${carol.id}`, { role: "owner" })).status,
    ).toBe(204)
    expect((await alice.call("DELETE", `/publishers/${org}/members/${alice.id}`)).status).toBe(204)
    const contact = await db.query.publisher.findFirst({ where: eq(schema.publisher.id, org) })
    expect(contact?.ownerId).toBe(carol.id)
  })
})

describe("personal publishers", () => {
  test("are one person and nobody can be invited to them", async () => {
    const mira = await person("Mira")
    const own = await json<DashboardPublisher>(
      await mira.call("POST", "/publishers", { kind: "person", name: "Mira", agreement: AGREEMENT_VERSION }),
    )
    expect(
      (
        await mira.call("POST", `/publishers/${own.id}/invites`, {
          email: "dee@example.com",
          role: "developer",
        })
      ).status,
    ).toBe(409)
    expect(
      (
        await mira.call("POST", "/publishers", {
          kind: "person",
          name: "Mira again",
          agreement: AGREEMENT_VERSION,
        })
      ).status,
    ).toBe(409)
  })
})

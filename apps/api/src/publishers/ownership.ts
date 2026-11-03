import type { Role } from "@schelf/protocol"
import { and, eq, ne } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { fail } from "../lib/http.ts"
import { allow, type Membership, type PublisherRow } from "./access.ts"

type Actor = { id: string; role: Role }

const NEEDS_OWNER = "Every organisation keeps at least one owner. Make someone else an owner first."

function organisation(publisher: PublisherRow) {
  if (publisher.kind === "person")
    fail(409, "A personal publisher is just you; create an organisation to share it")
}

async function memberOf(publisherId: string, userId: string) {
  const row = await db.query.member.findFirst({
    where: and(eq(schema.member.publisherId, publisherId), eq(schema.member.userId, userId)),
  })
  if (!row) fail(404, "That person isn't a member")
  return row
}

async function otherOwner(publisherId: string, userId: string) {
  const row = await db.query.member.findFirst({
    where: and(
      eq(schema.member.publisherId, publisherId),
      eq(schema.member.role, "owner"),
      ne(schema.member.userId, userId),
    ),
  })
  return row?.userId ?? null
}

function moveContact(publisher: PublisherRow, from: string, to: string) {
  return db
    .update(schema.publisher)
    .set({ ownerId: to })
    .where(and(eq(schema.publisher.id, publisher.id), eq(schema.publisher.ownerId, from)))
}

async function successorOf(publisher: PublisherRow, userId: string) {
  const successor = await otherOwner(publisher.id, userId)
  if (!successor) fail(409, NEEDS_OWNER)
  return successor
}

export async function changeRole(publisher: PublisherRow, actor: Actor, userId: string, role: Role) {
  organisation(publisher)
  allow(actor.role, "members")
  const target = await memberOf(publisher.id, userId)
  if (target.role === role) return
  if (target.role === "owner" || role === "owner") allow(actor.role, "owners")
  const update = db
    .update(schema.member)
    .set({ role })
    .where(and(eq(schema.member.publisherId, publisher.id), eq(schema.member.userId, userId)))
  if (target.role !== "owner") return void (await update)
  const successor = await successorOf(publisher, userId)
  await db.batch([update, moveContact(publisher, userId, successor)])
}

export async function removeMember(publisher: PublisherRow, actor: Actor, userId: string) {
  organisation(publisher)
  const target = await memberOf(publisher.id, userId)
  if (userId !== actor.id) {
    allow(actor.role, "members")
    if (target.role === "owner") allow(actor.role, "owners")
  }
  const remove = db
    .delete(schema.member)
    .where(and(eq(schema.member.publisherId, publisher.id), eq(schema.member.userId, userId)))
  if (target.role !== "owner") return void (await remove)
  const successor = await successorOf(publisher, userId)
  await db.batch([moveContact(publisher, userId, successor), remove])
}

export async function transferOwnership(publisher: PublisherRow, actor: Actor, userId: string) {
  organisation(publisher)
  allow(actor.role, "owners")
  if (userId === actor.id) fail(409, "You already own it")
  await memberOf(publisher.id, userId)
  const membership = (user: string) =>
    and(eq(schema.member.publisherId, publisher.id), eq(schema.member.userId, user))
  await db.batch([
    db.update(schema.member).set({ role: "owner" }).where(membership(userId)),
    db.update(schema.member).set({ role: "admin" }).where(membership(actor.id)),
    moveContact(publisher, actor.id, userId),
  ])
}

export async function releaseOwnerships(userId: string) {
  const memberships: Membership[] = await db
    .select({ publisher: schema.publisher, role: schema.member.role })
    .from(schema.member)
    .innerJoin(schema.publisher, eq(schema.publisher.id, schema.member.publisherId))
    .where(and(eq(schema.member.userId, userId), eq(schema.publisher.kind, "organisation")))
  const moves = []
  for (const { publisher, role } of memberships) {
    if (role !== "owner") continue
    const successor = await otherOwner(publisher.id, userId)
    if (successor) {
      moves.push(moveContact(publisher, userId, successor))
      continue
    }
    const others = await db.$count(
      schema.member,
      and(eq(schema.member.publisherId, publisher.id), ne(schema.member.userId, userId)),
    )
    if (others) fail(409, `Make someone else an owner of ${publisher.name} before deleting your account`)
  }
  if (moves.length) await db.batch(moves as never)
}

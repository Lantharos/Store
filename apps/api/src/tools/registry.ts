import {
  addLine,
  installLine,
  isReservedToolName,
  type ProjectTool,
  type ShortNameState,
  type ToolEntry,
  toolAddress,
  toolsOf,
} from "@schelf/protocol"
import { and, eq, inArray, ne } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import type { AppRow } from "../signing/records.ts"

export type ShortNameRow = typeof schema.toolName.$inferSelect

export async function shortNames(names: string[]) {
  const rows = names.length
    ? await db.select().from(schema.toolName).where(inArray(schema.toolName.name, names))
    : []
  return new Map(rows.map((row) => [row.name, row]))
}

export function shortState(
  name: string,
  owner: { id: string; verified: boolean },
  row: ShortNameRow | undefined,
): ShortNameState {
  if (row) {
    if (row.publisherId !== owner.id) return "taken"
    return owner.verified ? "resolves" : "paused"
  }
  return isReservedToolName(name) ? "reserved" : "free"
}

export function projectTool(entry: ToolEntry, publisherSlug: string, short: ShortNameState): ProjectTool {
  const address = toolAddress(publisherSlug, entry.name)
  const handle = short === "resolves" ? entry.name : address
  return {
    name: entry.name,
    part: entry.part,
    address,
    short,
    install: installLine(handle),
    add: addLine(handle),
  }
}

export async function projectTools(
  app: Pick<AppRow, "tool" | "parts">,
  publisher: { id: string; slug: string; verified: boolean },
) {
  const entries = toolsOf(app)
  const rows = await shortNames(entries.map((entry) => entry.name))
  return entries.map((entry) =>
    projectTool(entry, publisher.slug, shortState(entry.name, publisher, rows.get(entry.name))),
  )
}

export async function otherHolder(app: Pick<AppRow, "id" | "publisherId">, name: string) {
  const others = await db
    .select()
    .from(schema.app)
    .where(
      and(
        eq(schema.app.publisherId, app.publisherId),
        ne(schema.app.id, app.id),
        ne(schema.app.status, "deleted"),
      ),
    )
  return others.find((other) => toolsOf(other).some((entry) => entry.name === name)) ?? null
}

export async function findTool(publisherSlug: string, name: string) {
  const rows = await db
    .select({ app: schema.app, publisher: schema.publisher })
    .from(schema.app)
    .innerJoin(schema.publisher, eq(schema.publisher.id, schema.app.publisherId))
    .where(and(eq(schema.publisher.slug, publisherSlug), ne(schema.app.status, "deleted")))
  for (const row of rows) {
    const entry = toolsOf(row.app).find((each) => each.name === name)
    if (entry) return { ...row, entry }
  }
  return null
}

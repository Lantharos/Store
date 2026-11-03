import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm"
import { db, schema } from "../db/client.ts"

const REFERENCES_KEPT = 10

export async function threadOfReferences(references: string[]) {
  if (!references.length) return null
  const [known] = await db
    .select({ item: schema.mail.pultItem })
    .from(schema.mail)
    .where(and(inArray(schema.mail.messageId, references.slice(-50)), isNotNull(schema.mail.pultItem)))
    .orderBy(desc(schema.mail.createdAt))
    .limit(1)
  return known?.item ?? null
}

export async function threadingHeaders(item: string): Promise<Record<string, string>> {
  const messages = await db
    .select({ messageId: schema.mail.messageId, direction: schema.mail.direction })
    .from(schema.mail)
    .where(and(eq(schema.mail.pultItem, item), isNotNull(schema.mail.messageId)))
    .orderBy(asc(schema.mail.createdAt))
  const latest = messages.findLast((message) => message.direction === "in")
  if (!latest) return {}
  const references = messages.slice(-REFERENCES_KEPT).map((message) => `<${message.messageId}>`)
  return { "In-Reply-To": `<${latest.messageId}>`, References: references.join(" ") }
}

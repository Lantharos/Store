import { env } from "cloudflare:workers"

const TRIGRAM = 3
const MAX_TRIGRAMS = 24

export interface SearchDocument {
  key: string
  name: string
  summary: string
  keywords: string[]
  developer: string
}

export function storeKey(id: string) {
  return `schelf:${id}`
}

function trigrams(query: string) {
  const grams = new Set<string>()
  for (const word of query.toLowerCase().split(/\s+/)) {
    const clean = word.replace(/"/g, "")
    if (clean.length < TRIGRAM) continue
    for (let index = 0; index + TRIGRAM <= clean.length; index++)
      grams.add(clean.slice(index, index + TRIGRAM))
  }
  return [...grams].slice(0, MAX_TRIGRAMS)
}

export function matchExpression(query: string) {
  const grams = trigrams(query)
  return grams.length ? grams.map((gram) => `"${gram}"`).join(" OR ") : null
}

export function indexStatements(documents: SearchDocument[]) {
  const remove = env.DB.prepare("DELETE FROM search WHERE key = ?")
  const insert = env.DB.prepare(
    "INSERT INTO search (key, name, summary, keywords, developer) VALUES (?, ?, ?, ?, ?)",
  )
  return documents.flatMap((document) => [
    remove.bind(document.key),
    insert.bind(
      document.key,
      document.name,
      document.summary,
      document.keywords.join(" "),
      document.developer,
    ),
  ])
}

export function unindexStatement(key: string) {
  return env.DB.prepare("DELETE FROM search WHERE key = ?").bind(key)
}

export function clearOriginStatement(origin: string) {
  return env.DB.prepare("DELETE FROM search WHERE key >= ? AND key < ?").bind(`${origin}:`, `${origin};`)
}

export async function searchKeys(query: string, limit: number, prefix?: string) {
  const expression = matchExpression(query)
  if (!expression) return []
  const scoped = prefix ? "AND key >= ?2 AND key < ?3" : ""
  const statement = env.DB.prepare(
    `SELECT key, name, bm25(search, 0, 10, 3, 4, 1) AS score FROM search WHERE search MATCH ?1 ${scoped} ORDER BY score LIMIT ?4`,
  )
  const bound = prefix
    ? statement.bind(expression, `${prefix}:`, `${prefix};`, limit)
    : statement.bind(expression, null, null, limit)
  const { results } = await bound.all<{ key: string; name: string; score: number }>()
  return results
}

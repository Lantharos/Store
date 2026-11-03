import { env } from "cloudflare:workers"

const TRIGRAM = 3
const MAX_TRIGRAMS = 24

export interface SearchDocument {
  key: string
  name: string
  summary: string
  keywords: string[]
  publisher: string
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
      document.publisher,
    ),
  ])
}

export function unindexStatement(key: string) {
  return env.DB.prepare("DELETE FROM search WHERE key = ?").bind(key)
}

export function clearOriginStatement(origin: string) {
  return env.DB.prepare("DELETE FROM search WHERE key >= ? AND key < ?").bind(`${origin}:`, `${origin};`)
}

interface Hit {
  key: string
  name: string
}

function scoped(prefix: string | undefined) {
  return prefix
    ? { clause: "AND key >= ?3 AND key < ?4", bounds: [`${prefix}:`, `${prefix};`] }
    : { clause: "", bounds: [] }
}

async function prefixHits(query: string, limit: number, prefix: string | undefined) {
  const { clause, bounds } = scoped(prefix)
  const { results } = await env.DB.prepare(
    `SELECT key, name FROM search WHERE (name LIKE ?1 || '%' OR name LIKE '% ' || ?1 || '%') ${clause} ORDER BY length(name) LIMIT ?2`,
  )
    .bind(query.replace(/[%_]/g, ""), limit, ...bounds)
    .all<Hit>()
  return results
}

async function fuzzyHits(query: string, limit: number, prefix: string | undefined) {
  const expression = matchExpression(query)
  if (!expression) return []
  const { clause, bounds } = scoped(prefix)
  const { results } = await env.DB.prepare(
    `SELECT key, name FROM search WHERE search MATCH ?1 ${clause} ORDER BY bm25(search, 0, 10, 3, 4, 1) LIMIT ?2`,
  )
    .bind(expression, limit, ...bounds)
    .all<Hit>()
  return results
}

export async function searchKeys(query: string, limit: number, prefix?: string) {
  const [starts, similar] = await Promise.all([
    prefixHits(query.trim(), limit, prefix),
    fuzzyHits(query, limit, prefix),
  ])
  const seen = new Set<string>()
  return [...starts, ...similar].filter((hit) => !seen.has(hit.key) && seen.add(hit.key)).slice(0, limit)
}

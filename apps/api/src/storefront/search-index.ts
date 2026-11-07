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

interface Document extends Hit {
  summary: string
  keywords: string
}

const SCHELF_FIRST = "(key >= 'schelf:' AND key < 'schelf;') DESC"

const words = (text: string) =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)

function distance(left: string, right: string) {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let row = 1; row <= left.length; row++) {
    const current = [row]
    for (let column = 1; column <= right.length; column++) {
      const swap = left.charAt(row - 1) === right.charAt(column - 1) ? 0 : 1
      current.push(Math.min(previous[column]! + 1, current[column - 1]! + 1, previous[column - 1]! + swap))
    }
    previous = current
  }
  return previous[right.length]!
}

/** Whether every word searched for starts a word of the app's, or is that word with a typo or two. */
function close(query: string, document: Document) {
  const own = words(`${document.name} ${document.keywords} ${document.summary}`)
  return words(query)
    .filter((word) => word.length >= TRIGRAM)
    .every((word) => {
      const typos = word.length >= 8 ? 2 : word.length >= 6 ? 1 : 0
      return own.some((candidate) => candidate.startsWith(word) || distance(word, candidate) <= typos)
    })
}

function scoped(prefix: string | undefined) {
  return prefix
    ? { clause: "AND key >= ?3 AND key < ?4", bounds: [`${prefix}:`, `${prefix};`] }
    : { clause: "", bounds: [] }
}

async function prefixHits(query: string, limit: number, prefix: string | undefined) {
  const { clause, bounds } = scoped(prefix)
  const { results } = await env.DB.prepare(
    `SELECT key, name FROM search WHERE (name LIKE ?1 || '%' OR name LIKE '% ' || ?1 || '%') ${clause}
     ORDER BY lower(name) = lower(?1) DESC, name LIKE ?1 || '%' DESC, ${SCHELF_FIRST}, length(name) LIMIT ?2`,
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
    `SELECT key, name, summary, keywords FROM search WHERE search MATCH ?1 ${clause} ORDER BY bm25(search, 0, 10, 3, 4, 1) LIMIT ?2`,
  )
    .bind(expression, limit, ...bounds)
    .all<Document>()
  return results.filter((document) => close(query, document)).map(({ key, name }) => ({ key, name }))
}

/**
 * Names that are what was searched for come first, then names that start with it, then names with a word that does,
 * with schelf.store's own apps first among equals, and then apps whose words match despite a typo.
 */
export async function searchKeys(query: string, limit: number, prefix?: string) {
  const [starts, similar] = await Promise.all([
    prefixHits(query.trim(), limit, prefix),
    fuzzyHits(query, limit, prefix),
  ])
  const seen = new Set<string>()
  return [...starts, ...similar].filter((hit) => !seen.has(hit.key) && seen.add(hit.key)).slice(0, limit)
}

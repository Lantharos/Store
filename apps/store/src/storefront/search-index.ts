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

export const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase()

function trigrams(query: string) {
  const grams = new Set<string>()
  for (const word of query.split(/\s+/)) {
    const clean = word.replace(/"/g, "")
    if (clean.length < TRIGRAM) continue
    for (let index = 0; index + TRIGRAM <= clean.length; index++)
      grams.add(clean.slice(index, index + TRIGRAM))
  }
  return [...grams].slice(0, MAX_TRIGRAMS)
}

function matchExpression(query: string) {
  const grams = trigrams(query)
  return grams.length ? grams.map((gram) => `"${gram}"`).join(" OR ") : null
}

const DROP_TEXT = "DELETE FROM search_text WHERE rowid = (SELECT id FROM search_key WHERE key = ?1)"
const UPSERT_KEY =
  "INSERT INTO search_key (key) VALUES (?1) ON CONFLICT (key) DO UPDATE SET key = excluded.key"
const ADD_KEY = "INSERT INTO search_key (key) VALUES (?1)"
const ADD_TEXT = `INSERT INTO search_text (rowid, key, title, name, summary, keywords, developer)
  VALUES ((SELECT id FROM search_key WHERE key = ?1), ?1, ?2, ?3, ?4, ?5, ?6)`

function addText(statement: D1PreparedStatement, document: SearchDocument) {
  return statement.bind(
    document.key,
    document.name,
    fold(document.name),
    fold(document.summary),
    fold(document.keywords.join(" ")),
    fold(document.publisher),
  )
}

/** App ids are compared without case, so an entry left under an id's old spelling goes too. */
export function indexStatements(documents: SearchDocument[]) {
  const [drop, upsert, add] = [DROP_TEXT, UPSERT_KEY, ADD_TEXT].map((query) => env.DB.prepare(query))
  return documents.flatMap((document) => [
    drop!.bind(document.key),
    upsert!.bind(document.key),
    addText(add!, document),
  ])
}

/** Entries that aren't in the index under any spelling of their key, such as an origin's once it's cleared. */
export function addStatements(documents: SearchDocument[]) {
  const [key, add] = [ADD_KEY, ADD_TEXT].map((query) => env.DB.prepare(query))
  return documents.flatMap((document) => [key!.bind(document.key), addText(add!, document)])
}

export function unindexStatements(key: string) {
  return [
    env.DB.prepare(DROP_TEXT).bind(key),
    env.DB.prepare("DELETE FROM search_key WHERE key = ?1").bind(key),
  ]
}

export function clearOriginStatements(origin: string) {
  const bounds = [`${origin}:`, `${origin};`]
  return [
    env.DB.prepare(
      "DELETE FROM search_text WHERE rowid IN (SELECT id FROM search_key WHERE key >= ?1 AND key < ?2)",
    ).bind(...bounds),
    env.DB.prepare("DELETE FROM search_key WHERE key >= ?1 AND key < ?2").bind(...bounds),
  ]
}

interface Hit {
  key: string
  name: string
}

interface Document extends Hit {
  text: string
}

const SCHELF_FIRST = "(key >= 'schelf:' AND key < 'schelf;') DESC"

const words = (text: string) => text.split(/[^\p{L}\p{N}]+/u).filter(Boolean)

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
  const own = words(document.text)
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
    `SELECT key, title AS name FROM search_text
     WHERE name LIKE '%' || ?1 || '%' AND (name LIKE ?1 || '%' OR name LIKE '% ' || ?1 || '%') ${clause}
     ORDER BY name = ?1 DESC, name LIKE ?1 || '%' DESC, ${SCHELF_FIRST}, length(name) LIMIT ?2`,
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
    `SELECT key, title AS name, name || ' ' || keywords || ' ' || summary AS text FROM search_text
     WHERE search_text MATCH ?1 ${clause} ORDER BY bm25(search_text, 0, 0, 10, 3, 4, 1) LIMIT ?2`,
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
  const wanted = fold(query.trim())
  const [starts, similar] = await Promise.all([
    prefixHits(wanted, limit, prefix),
    fuzzyHits(wanted, limit, prefix),
  ])
  const seen = new Set<string>()
  return [...starts, ...similar].filter((hit) => !seen.has(hit.key) && seen.add(hit.key)).slice(0, limit)
}

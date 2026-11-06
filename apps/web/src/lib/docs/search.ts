export interface DocSection {
  slug: string
  id: string | null
  page: string
  heading: string | null
  text: string
}

export interface DocHit {
  section: DocSection
  snippet: string
}

const SNIPPET_LEAD = 40
const SNIPPET_LENGTH = 130
const LIMIT = 8

function snippetOf(text: string, term: string) {
  const start = Math.max(0, text.toLowerCase().indexOf(term) - SNIPPET_LEAD)
  const snippet = text.slice(start, start + SNIPPET_LENGTH).trim()
  return `${start > 0 ? "…" : ""}${snippet}${start + SNIPPET_LENGTH < text.length ? "…" : ""}`
}

function scoreOf(section: DocSection, terms: string[]) {
  const page = section.page.toLowerCase()
  const heading = section.heading?.toLowerCase() ?? ""
  const text = section.text.toLowerCase()
  let score = 0
  for (const term of terms) {
    const weight =
      (page.includes(term) ? 6 : 0) + (heading.includes(term) ? 4 : 0) + (text.includes(term) ? 1 : 0)
    if (!weight) return 0
    score += weight
  }
  return section.id === null ? score + 1 : score
}

export function searchDocs(sections: DocSection[], query: string): DocHit[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return []
  return sections
    .map((section) => ({ section, score: scoreOf(section, terms) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, LIMIT)
    .map(({ section }) => ({ section, snippet: snippetOf(section.text, terms[0]!) }))
}

export const hitHref = ({ slug, id }: DocSection) =>
  `${slug === "getting-started" ? "/docs" : `/docs/${slug}`}${id ? `#${id}` : ""}`

import MarkdownIt from "markdown-it"
import { createCssVariablesTheme, createHighlighter } from "shiki"

export interface Heading {
  id: string
  text: string
}

export interface Page {
  slug: string
  title: string
  description: string
  html: string
  headings: Heading[]
}

const theme = createCssVariablesTheme({ name: "schelf", variablePrefix: "--shiki-" })
const LANGUAGES = { sh: "shellscript", toml: "toml", yaml: "yaml", ts: "typescript", json: "json" } as const
const highlighter = await createHighlighter({ themes: [theme], langs: Object.values(LANGUAGES) })

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[`'"“”]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight(code, lang) {
    const language = LANGUAGES[lang as keyof typeof LANGUAGES]
    if (!language) return ""
    return highlighter.codeToHtml(code.trimEnd(), { lang: language, theme: "schelf" })
  },
})

const fence = markdown.renderer.rules.fence!
markdown.renderer.rules.fence = (tokens, index, options, env, self) => {
  const token = tokens[index]!
  const html = fence(tokens, index, options, env, self)
  const code = markdown.utils.escapeHtml(token.content.trimEnd())
  return `<div class="code-block" data-lang="${markdown.utils.escapeHtml(token.info)}">${html}<button type="button" class="copy" data-copy="${code}" aria-label="Copy">Copy</button></div>`
}

const FRONTMATTER = /^---\ntitle: (.+)\ndescription: (.+)\n---\n/

export function renderPage(slug: string, source: string): Page {
  const match = FRONTMATTER.exec(source)
  if (!match) throw new Error(`${slug}.md needs to start with a title and a description`)
  const headings: Heading[] = []
  const tokens = markdown.parse(source.slice(match[0].length), {})
  tokens.forEach((token, index) => {
    if (token.type !== "heading_open") return
    const text = tokens[index + 1]?.content ?? ""
    const id = slugify(text)
    token.attrSet("id", id)
    if (token.tag === "h2") headings.push({ id, text: text.replaceAll("`", "") })
  })
  return {
    slug,
    title: match[1]!,
    description: match[2]!,
    html: markdown.renderer.render(tokens, markdown.options, {}),
    headings,
  }
}

import { STORE_ORIGIN } from "@schelf/protocol"
import { docMarkdown, docPage } from "../content/docs.ts"
import { DOC_ORDER, DOC_SECTIONS } from "./nav.ts"

const SUMMARY =
  "Schelf delivers apps you already build in GitHub Actions: a download page that picks the right file, reviewed updates, and a listing on the Schelf store and Luft."

const absolute = (markdown: string) => markdown.replaceAll("](/", `](${STORE_ORIGIN}/`)

export function docAsMarkdown(slug: string) {
  const page = docPage(slug)
  const body = docMarkdown(slug)
  return page && body && `# ${page.title}\n\n> ${page.description}\n\n${absolute(body)}\n`
}

export function llmsIndex() {
  const sections = DOC_SECTIONS.map(({ title, pages }) => {
    const links = pages.map((slug) => {
      const page = docPage(slug)!
      return `- [${page.title}](${STORE_ORIGIN}/docs/${slug}.md): ${page.description}`
    })
    return `## ${title}\n\n${links.join("\n")}`
  })
  return `# Schelf\n\n> ${SUMMARY}\n\n${sections.join("\n\n")}\n`
}

export function llmsFull() {
  return `# Schelf\n\n> ${SUMMARY}\n\n${DOC_ORDER.map(docAsMarkdown).join("\n")}`
}

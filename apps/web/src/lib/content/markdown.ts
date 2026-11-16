import MarkdownIt from "markdown-it"

const markdown = new MarkdownIt({ html: false, linkify: true, breaks: false }).disable("image")
const defaultLink =
  markdown.renderer.rules.link_open ??
  ((tokens, index, options, _env, self) => self.renderToken(tokens, index, options))

markdown.renderer.rules.link_open = (tokens, index, options, env, self) => {
  tokens[index]!.attrSet("rel", "nofollow noopener ugc")
  return defaultLink(tokens, index, options, env, self)
}

export const renderUserMarkdown = (text: string) => markdown.render(text)

const PLAIN: Record<string, (content: string) => string> = {
  text: (content) => content,
  code_inline: (content) => content,
  softbreak: () => " ",
  hardbreak: () => " ",
}

export function firstParagraph(text: string) {
  const tokens = markdown.parse(text, {})
  const opening = tokens.findIndex((token) => token.type === "paragraph_open")
  if (opening < 0) return ""
  return (tokens[opening + 1]!.children ?? [])
    .map((token) => PLAIN[token.type]?.(token.content) ?? "")
    .join("")
}

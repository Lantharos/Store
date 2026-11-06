import MarkdownIt from "markdown-it"

const markdown = new MarkdownIt({ html: false, linkify: true, breaks: false })
const defaultLink =
  markdown.renderer.rules.link_open ??
  ((tokens, index, options, _env, self) => self.renderToken(tokens, index, options))

markdown.renderer.rules.link_open = (tokens, index, options, env, self) => {
  tokens[index]!.attrSet("rel", "nofollow noopener")
  return defaultLink(tokens, index, options, env, self)
}

export const renderUserMarkdown = (text: string) => markdown.render(text)

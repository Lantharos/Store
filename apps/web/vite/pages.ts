import type { Plugin } from "vite"
import { renderPage } from "./markdown.ts"

const CONTENT = /\/src\/content\/.+\.md$/

export function markdownPages(): Plugin {
  return {
    name: "schelf-markdown-pages",
    enforce: "pre",
    async transform(source, id) {
      if (!CONTENT.test(id)) return
      const slug = id.slice(id.lastIndexOf("/") + 1, -3)
      return { code: `export default ${JSON.stringify(await renderPage(slug, source))}`, map: null }
    },
  }
}

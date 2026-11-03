import { createCssVariablesTheme, createHighlighterCore } from "shiki/core"
import { createJavaScriptRegexEngine } from "shiki/engine/javascript"

export type Language = "toml" | "yaml" | "sh" | "html"

const theme = createCssVariablesTheme({ name: "schelf", variablePrefix: "--shiki-" })

const highlighter = createHighlighterCore({
  themes: [theme],
  langs: [
    import("shiki/langs/toml.mjs"),
    import("shiki/langs/yaml.mjs"),
    import("shiki/langs/shellscript.mjs"),
    import("shiki/langs/html.mjs"),
  ],
  engine: createJavaScriptRegexEngine(),
})

export async function highlight(code: string, lang: Language) {
  const instance = await highlighter
  return instance.codeToHtml(code, { lang: lang === "sh" ? "shellscript" : lang, theme: "schelf" })
}

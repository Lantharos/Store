const light = {
  canvas: "#fcf9f3",
  well: "#ebe8e2",
  ink: "#1d1b17",
  inkSoft: "#4a463e",
  inkMuted: "#6f6b62",
  accent: "#725b2d",
  accentInk: "#ffffff",
}

const dark: typeof light = {
  canvas: "#12110e",
  well: "#2c2a25",
  ink: "#ece9e3",
  inkSoft: "#cbc6bd",
  inkMuted: "#a29d93",
  accent: "#ddc393",
  accentInk: "#402d00",
}

export const colors = light

export const FONT =
  "'Open Runde', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

const darkRules = (scope: string) =>
  [
    `${scope} .canvas { background-color: ${dark.canvas} !important; }`,
    `${scope} .well { background-color: ${dark.well} !important; }`,
    `${scope} .ink { color: ${dark.ink} !important; }`,
    `${scope} .ink-soft { color: ${dark.inkSoft} !important; }`,
    `${scope} .ink-muted, ${scope} .ink-muted a { color: ${dark.inkMuted} !important; }`,
    `${scope} .rule { border-color: ${dark.well} !important; }`,
    `${scope} .button { background-color: ${dark.accent} !important; }`,
    `${scope} .button a { color: ${dark.accentInk} !important; }`,
    `${scope} .mark-light { display: none !important; }`,
    `${scope} .mark-dark { display: inline-block !important; max-height: none !important; overflow: visible !important; }`,
  ].join("\n")

const fontFace = (origin: string, file: string, weight: number) =>
  `@font-face { font-family: 'Open Runde'; font-weight: ${weight}; font-style: normal; src: url('${origin}/fonts/${file}.woff2') format('woff2'); }`

export function stylesheets(origin: string) {
  return [
    [
      ":root { color-scheme: light dark; supported-color-schemes: light dark; }",
      "body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; }",
      "a { text-decoration: none; }",
      "@media (max-width: 480px) { .page { padding: 28px 20px !important; } .heading { font-size: 24px !important; } }",
      `@media (prefers-color-scheme: dark) {\n${darkRules(":root")}\n}`,
    ],
    [
      fontFace(origin, "OpenRunde-Regular", 400),
      fontFace(origin, "OpenRunde-Medium", 500),
      fontFace(origin, "OpenRunde-Semibold", 600),
    ],
    [darkRules("[data-ogsc]")],
  ].map((rules) => `<style>\n${rules.join("\n")}\n</style>`)
}

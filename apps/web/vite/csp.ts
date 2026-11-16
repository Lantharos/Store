import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import type { Config } from "@sveltejs/kit/vite"

const appHtml = readFileSync(new URL("../src/app.html", import.meta.url), "utf8")
const inlineScripts = [...appHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
  ([, body]) => `sha256-${createHash("sha256").update(body!).digest("base64")}` as const,
)

export const csp: Config["csp"] = {
  mode: "hash",
  directives: {
    "default-src": ["self"],
    "script-src": ["self", "wasm-unsafe-eval", ...inlineScripts],
    "style-src": ["self", "unsafe-inline"],
    "img-src": ["self", "data:", "blob:", "https:"],
    "font-src": ["self"],
    "connect-src": ["self"],
    "object-src": ["none"],
    "base-uri": ["self"],
    "form-action": ["self"],
    "frame-ancestors": ["none"],
  },
}

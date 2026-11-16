import adapter from "@sveltejs/adapter-cloudflare"
import { sveltekit } from "@sveltejs/kit/vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import { csp } from "./vite/csp.ts"
import { markdownPages } from "./vite/pages.ts"

const API = "http://localhost:8787"

export default defineConfig({
  plugins: [
    markdownPages(),
    tailwindcss(),
    sveltekit({ adapter: adapter(), csp, version: { pollInterval: 60_000 } }),
  ],
  server: {
    port: 5174,
    strictPort: true,
    proxy: { "/api": API },
  },
})

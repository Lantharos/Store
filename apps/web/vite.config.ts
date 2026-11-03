import adapter from "@sveltejs/adapter-cloudflare"
import { sveltekit } from "@sveltejs/kit/vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

const API = "http://localhost:8787"

export default defineConfig({
  plugins: [tailwindcss(), sveltekit({ adapter: adapter() })],
  server: {
    port: 5174,
    strictPort: true,
    proxy: { "/api": API },
  },
})

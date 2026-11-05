import { bindings, defineConfig, triggers } from "cf/config"

export default defineConfig({
  accountId: "2e3bfcbc9512a7ab1ea3a9cb9a474b30",
  worker: {
    name: "schelf-web",
    compatibilityDate: "2026-11-01",
    compatibilityFlags: ["nodejs_compat"],
    entrypoint: ".svelte-kit/cloudflare/_worker.js",
    observability: {
      enabled: true,
    },
    triggers: [
      triggers.fetch({
        pattern: "schelf.store/*",
        zone: "schelf.store",
      }),
    ],
    env: {
      API: bindings.worker({
        worker: "schelf-api",
      }),
      ASSETS: bindings.assets(),
    },
  },
})

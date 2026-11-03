import { defineConfig } from "@lantharos/pult"

export default defineConfig({
  project: "schelf",
  include: ["src/ops/define/**/*.ts"],
  delivery: { mode: "webhook", path: "/api/ops" },
  environments: ["dev", "prod"],
  sync: "dev",
})

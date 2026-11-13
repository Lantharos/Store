import { bindings, defineConfig, triggers } from "cf/config"
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" }

export default defineConfig({
  accountId: "2e3bfcbc9512a7ab1ea3a9cb9a474b30",
  worker: {
    name: "schelf-api",
    compatibilityDate: "2026-10-01",
    compatibilityFlags: ["nodejs_compat"],
    entrypoint,
    workersDev: false,
    previewUrls: false,
    limits: {
      cpuMs: 300000,
    },
    observability: {
      enabled: true,
    },
    domains: ["dl.schelf.store"],
    triggers: [
      triggers.fetch({
        pattern: "schelf.store/api/*",
        zone: "schelf.store",
      }),
      triggers.fetch({
        pattern: "schelf.store/install",
        zone: "schelf.store",
      }),
      triggers.fetch({
        pattern: "schelf.store/install/*",
        zone: "schelf.store",
      }),
      triggers.fetch({
        pattern: "*/*",
        zone: "schelf.store",
      }),
      triggers.scheduled({
        schedule: "0 * * * *",
      }),
      triggers.scheduled({
        schedule: "20 0 * * *",
      }),
      triggers.queue({
        maxBatchSize: 100,
        maxBatchTimeout: 2,
        maxConcurrency: 1,
        maxRetries: 10,
        name: "schelf-store-sign",
      }),
    ],
    env: {
      PUBLIC_URL: bindings.text("https://schelf.store"),
      DOWNLOAD_URL: bindings.text("https://dl.schelf.store"),
      NOTIFY_FROM: bindings.text("no-reply@schelf.store"),
      STORE_REPOSITORY_ID: bindings.text("1429206588"),
      ROOT_PUBLIC_KEY: bindings.text("kP/cqtRR3PN+8X1gMdRBXRsfqLq0l5Lsbv54K6FnqJg="),
      ACCOUNT_ID: bindings.text("2e3bfcbc9512a7ab1ea3a9cb9a474b30"),
      ZONE_ID: bindings.text("9e8a783fcabea6b50799a30fbb6ba9dc"),
      DOWNLOADS: bindings.analyticsEngineDataset({
        name: "schelf_downloads",
      }),
      DB: bindings.d1({
        name: "schelf-store",
        id: "a461f2c7-c13f-40bb-a9f7-23b32fb81181",
      }),
      BUCKET: bindings.r2({
        name: "schelf-store",
      }),
      EMAIL: bindings.sendEmail({}),
      SIGNING: bindings.queue({
        name: "schelf-store-sign",
      }),
      AUTH_LIMIT: bindings.rateLimit({
        namespace: "2001",
        simple: {
          limit: 20,
          period: 60,
        },
      }),
      REPORT_LIMIT: bindings.rateLimit({
        namespace: "2002",
        simple: {
          limit: 5,
          period: 60,
        },
      }),
      BETTER_AUTH_SECRET: bindings.secret(),
      UPLOAD_SECRET: bindings.secret(),
      STORE_SIGNING_KEY: bindings.secret(),
      GITHUB_CLIENT_ID: bindings.secret(),
      GITHUB_CLIENT_SECRET: bindings.secret(),
      GITHUB_TOKEN: bindings.secret(),
      SEALING_KEY: bindings.secret(),
      ANALYTICS_TOKEN: bindings.secret(),
      PULT_KEY: bindings.secret(),
      CUSTOM_HOSTNAMES_TOKEN: bindings.secret(),
      REQUEST_LIMIT: bindings.rateLimit({
        namespace: "2004",
        simple: {
          limit: 10,
          period: 60,
        },
      }),
      MAIL_LIMIT: bindings.rateLimit({
        namespace: "2003",
        simple: {
          limit: 10,
          period: 60,
        },
      }),
    },
  },
})

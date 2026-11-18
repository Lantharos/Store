declare module "cloudflare:workers" {
  export const env: Cloudflare.Env
  export function waitUntil(promise: Promise<unknown>): void
}

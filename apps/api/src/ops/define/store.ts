import { action, b } from "@lantharos/pult"
import { z } from "zod"
import { prepareSigningKey, publishStoreKeys } from "../../signing/keys.ts"
import { resignEverything } from "../../signing/queue.ts"

export const resign = action("resign-everything", {
  label: "Re-sign the index",
  description:
    "Signs every index file, update feed and the revocation list again with the current store key.",
  danger: "confirm",
  run: async () => `Re-signing ${await resignEverything()} apps, the catalog and the revocation list`,
})

export const prepareKey = action("prepare-store-key", {
  label: "Prepare a new store key",
  description:
    "Makes a new signing key inside the store. It isn't used until the root signs it into the published store keys.",
  danger: "confirm",
  run: async () => {
    const key = await prepareSigningKey()
    return {
      message: `Prepared store key ${key.id}`,
      blocks: [
        b.markdown(
          "Sign it with the root key on a trusted computer, then publish the result with Publish store keys.",
        ),
        b.code(`ROOT_KEY=<root key> bun scripts/store-keys.ts add ${key.publicKey} trust-out`, {
          lang: "sh",
        }),
      ],
    }
  },
})

export const publishKeys = action("publish-store-keys", {
  label: "Publish store keys",
  description:
    "Publishes a store-keys.json the root signed, switches signing to the newest key in it and re-signs everything.",
  input: z.object({
    body: z.string().min(1).describe("The contents of trust/v1/store-keys.json"),
    signature: z.string().min(1).describe("The contents of trust/v1/store-keys.json.sig"),
  }),
  danger: "reauth",
  run: async ({ input }) => {
    const keys = await publishStoreKeys(input.body, input.signature)
    const apps = await resignEverything()
    return `Published ${keys.length} store keys and re-signing ${apps} apps`
  },
})

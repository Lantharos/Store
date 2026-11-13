import { paths, signatureEnvelope, trustedStoreKeys, verifyDocument } from "@schelf/protocol"

export interface Store {
  origin: string
  rootKey: string
}

export class Offline extends Error {}

async function text(url: string) {
  const response = await fetch(url).catch((error: unknown) => {
    throw new Offline(`Couldn't reach ${new URL(url).host}: ${(error as Error).message}`)
  })
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
  return response.text()
}

async function sealed(store: Store, key: string) {
  const [body, seal] = await Promise.all([
    text(`${store.origin}/${key}`),
    text(`${store.origin}/${paths.signature(key)}`),
  ])
  return { body, envelope: signatureEnvelope.parse(JSON.parse(seal)) }
}

export async function storeKeys(store: Store) {
  const { body, envelope } = await sealed(store, paths.storeKeys)
  return trustedStoreKeys(store.rootKey, body, envelope)
}

export async function readSigned<T extends { path: string; expires: string }>(
  store: Store,
  keys: Map<string, string>,
  key: string,
  schema: { parse: (value: unknown) => T },
) {
  const { body, envelope } = await sealed(store, key)
  if (!(await verifyDocument(keys, body, envelope))) throw new Error(`${key} isn't signed by schelf.store`)
  const document = schema.parse(JSON.parse(body))
  if (document.path !== key) throw new Error(`${key} was signed for ${document.path}`)
  if (new Date(document.expires) <= new Date()) throw new Error(`${key} expired on ${document.expires}`)
  return document
}

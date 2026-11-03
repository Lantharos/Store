import { type Namespace, namespaceCovers } from "@schelf/protocol"
import type { Dashboard } from "../api/dashboard.ts"
import { blank, done, Failure, field, line, note, step } from "../ui/output.ts"
import { ask, choose } from "../ui/prompt.ts"
import { accent, bold, interactive } from "../ui/style.ts"

export function suggestedNamespace(id: string) {
  const parts = id.toLowerCase().split(".")
  return parts.slice(0, parts[0] === "io" && parts[1] === "github" ? 3 : 2).join(".")
}

const isGithubNamespace = (prefix: string) => prefix.startsWith("io.github.")

async function proveDomain(account: Dashboard, namespace: Namespace): Promise<Namespace> {
  const domain = namespace.prefix.split(".").reverse().join(".")
  blank()
  line(`Prove you own ${bold(domain)} with either of these:`)
  blank()
  field("DNS", `a TXT record on ${domain}: ${accent(`schelf-verify=${namespace.token}`)}`)
  field("Web", `https://${domain}/.well-known/schelf-store.txt containing ${accent(namespace.token)}`)
  blank()
  if (!interactive) {
    throw new Failure(`${namespace.prefix} isn't proven yet`, "Add the record, then run schelf init again.")
  }
  const method = await choose("How will you prove it?", [
    { label: "DNS record", value: "dns" as const },
    { label: "File on the website", value: "well-known" as const },
  ])
  for (;;) {
    await ask("Press Enter once it's in place")
    const checked = await step(`Checking ${domain}`, () =>
      account.verifyNamespace(namespace.prefix, method),
    ).catch(() => undefined)
    if (checked?.verified) return checked
    note("Not visible yet. DNS changes can take a few minutes to spread.")
  }
}

export async function ensureNamespace(account: Dashboard, id: string): Promise<string> {
  const namespaces = await account.namespaces()
  const proven = namespaces.find((namespace) => namespace.verified && namespaceCovers(namespace.prefix, id))
  if (proven) {
    done(`${bold(proven.prefix)} is yours`)
    return proven.prefix
  }
  let prefix = suggestedNamespace(id)
  if (!isGithubNamespace(prefix) && interactive) {
    prefix = (await ask("Which namespace do you own?", prefix)).toLowerCase()
    if (!namespaceCovers(prefix, id)) throw new Failure(`${id} isn't under ${prefix}`)
  }
  const claimed =
    namespaces.find((namespace) => namespace.prefix === prefix) ??
    (await step(`Claiming ${prefix}`, () => account.claimNamespace(prefix)))
  if (isGithubNamespace(prefix)) {
    const verified = await step(`Proving ${prefix} through GitHub`, () =>
      account.verifyNamespace(prefix, "github"),
    )
    if (!verified.verified) {
      throw new Failure(
        `Your GitHub account can't prove ${prefix}`,
        "Sign in with that GitHub account, or as an owner of that organisation.",
      )
    }
    return prefix
  }
  await proveDomain(account, claimed)
  done(`${bold(prefix)} is yours`)
  return prefix
}

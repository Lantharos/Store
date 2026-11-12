import { type ApprovalAction, type Namespace, NEW_PUBLISHER, namespaceCovers } from "@schelf/protocol"
import type { Dashboard } from "../api/dashboard.ts"
import { EXIT } from "../ui/exit.ts"
import { blank, done, Failure, field, line, note, step } from "../ui/output.ts"
import { ask, choose } from "../ui/prompt.ts"
import { accent, bold, interactive } from "../ui/style.ts"
import type { Owner } from "./register.ts"

export function suggestedNamespace(id: string) {
  const parts = id.toLowerCase().split(".")
  return parts.slice(0, parts[0] === "io" && parts[1] === "github" ? 3 : 2).join(".")
}

const isGithubNamespace = (prefix: string) => prefix.startsWith("io.github.")

export interface NamespacePlan {
  prefix: string
  proven: boolean
}

export async function planNamespace(
  account: Dashboard,
  owner: Owner,
  id: string,
  wanted: string | undefined,
  plan: ApprovalAction[],
): Promise<NamespacePlan> {
  const namespaces = owner.id === NEW_PUBLISHER ? [] : await account.namespaces(owner.id)
  const proven = namespaces.find((namespace) => namespace.verified && namespaceCovers(namespace.prefix, id))
  if (proven) {
    done(`${bold(proven.prefix)} is yours`)
    return { prefix: proven.prefix, proven: true }
  }
  let prefix = (wanted ?? suggestedNamespace(id)).toLowerCase()
  if (!wanted && !isGithubNamespace(prefix) && interactive)
    prefix = (await ask("Which namespace do you own?", prefix)).toLowerCase()
  if (!namespaceCovers(prefix, id)) throw new Failure(`${id} isn't under ${prefix}`, undefined, EXIT.usage)
  if (!namespaces.some((namespace) => namespace.prefix === prefix))
    plan.push({ type: "namespace.claim", publisher: owner.id, prefix })
  if (!isGithubNamespace(prefix)) return { prefix, proven: false }
  if (owner.id === NEW_PUBLISHER || !namespaces.some((namespace) => namespace.prefix === prefix))
    plan.push({ type: "namespace.verify", publisher: owner.id, prefix, method: "github" })
  else
    await step(`Proving ${prefix} through GitHub`, () => account.verifyNamespace(owner.id, prefix, "github"))
  return { prefix, proven: true }
}

export async function proveDomain(account: Dashboard, publisherId: string, namespace: Namespace) {
  const domain = namespace.prefix.split(".").reverse().join(".")
  blank()
  line(`Prove you own ${bold(domain)} with either of these:`)
  blank()
  field("DNS", `a TXT record on ${domain}: ${accent(`schelf-verify=${namespace.token}`)}`)
  field("Web", `https://${domain}/.well-known/schelf-store.txt containing ${accent(namespace.token)}`)
  blank()
  if (!interactive)
    throw new Failure(
      `${namespace.prefix} isn't proven yet`,
      "Add the record, then run schelf init again.",
      EXIT.waiting,
    )
  const method = await choose("How will you prove it?", [
    { label: "DNS record", value: "dns" as const },
    { label: "File on the website", value: "well-known" as const },
  ])
  for (;;) {
    await ask("Press Enter once it's in place")
    const checked = await step(`Checking ${domain}`, () =>
      account.verifyNamespace(publisherId, namespace.prefix, method),
    ).catch(() => undefined)
    if (checked?.verified) return
    note("Not visible yet. DNS changes can take a few minutes to spread.")
  }
}

export async function retryDomainProof(account: Dashboard, publisherId: string, prefix: string) {
  const namespace = (await account.namespaces(publisherId)).find((entry) => entry.prefix === prefix)!
  for (const method of ["dns", "well-known"] as const) {
    const checked = await account.verifyNamespace(publisherId, prefix, method).catch(() => undefined)
    if (checked?.verified) return done(`${bold(prefix)} is yours`)
  }
  await proveDomain(account, publisherId, namespace)
  done(`${bold(prefix)} is yours`)
}

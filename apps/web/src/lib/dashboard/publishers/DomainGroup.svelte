<script lang="ts">
  import { type CustomDomainState, customDomain } from "@schelf/protocol"
  import CopyButton from "../../code/CopyButton.svelte"
  import { ago } from "../../format.ts"
  import Group from "../../ui/group/Group.svelte"
  import Row from "../../ui/group/Row.svelte"
  import Confirm from "../../ui/overlay/Confirm.svelte"
  import { toasts } from "../../ui/overlay/toasts.svelte.ts"
  import { api } from "../api/client.ts"
  import { endpoints } from "../api/endpoints.ts"

  let {
    publisher,
    slug,
    editable,
    verified,
  }: { publisher: string; slug: string; editable: boolean; verified: boolean } = $props()

  let domain = $state<CustomDomainState | null>(null)
  let wanted = $state("")
  let busy = $state(false)
  let removing = $state(false)
  const STATUS = {
    proving: "Waiting for its DNS records",
    connecting: "Connecting",
    active: "Serving your links",
    paused: "Paused",
  }

  $effect(() => {
    api.get<CustomDomainState | null>(endpoints.publisherDomain(publisher)).then((found) => (domain = found))
  })

  async function run(task: () => Promise<CustomDomainState | null>) {
    busy = true
    try {
      domain = await task()
    } catch (error) {
      toasts.error(error)
    } finally {
      busy = false
    }
  }

  function connect(event: SubmitEvent) {
    event.preventDefault()
    const parsed = customDomain.safeParse(wanted)
    if (!parsed.success) return toasts.show(parsed.error.issues[0]!.message, "danger")
    run(() => api.put(endpoints.publisherDomain(publisher), { domain: parsed.data }))
  }
</script>

<Group title="Download domain" description="A domain of yours that serves the download links of all your projects, like dl.example.com/<project>/latest." rows>
  {#if domain}
    <Row title={domain.domain} description={domain.waiting ?? STATUS[domain.status]}>
      {#if editable}<button type="button" class="button button-sm button-quiet" disabled={busy} onclick={() => (removing = true)}>Remove</button>{/if}
    </Row>
    {#if domain.status === "proving" || domain.status === "connecting"}
      {#each domain.records as record (record.type)}
        <Row title="{record.type} {record.name}">
          <code class="max-w-64 truncate font-mono text-[13px] text-ink-soft">{record.value}</code>
          <CopyButton text={record.value} label="Copy the {record.type} value" compact />
        </Row>
      {/each}
      {#if editable}
        <Row title="Checked {domain.checked_at ? ago(domain.checked_at) : 'never'}" description="Schelf looks again every hour.">
          <button type="button" class="button button-sm button-quiet" disabled={busy} onclick={() => run(() => api.post(endpoints.checkPublisherDomain(publisher)))}>Check now</button>
        </Row>
      {/if}
    {/if}
  {:else if !verified}
    <Row title="Comes with verification" description="A verified publisher can serve its links from its own domain.">
      <a href="/dashboard/settings/verification" class="button button-sm button-quiet">Verification</a>
    </Row>
  {:else if editable}
    <form class="flex gap-2 px-5 py-3.5" onsubmit={connect}>
      <input class="field min-w-0 flex-1" placeholder="dl.example.com" aria-label="Domain" bind:value={wanted} spellcheck="false" />
      <button class="button button-primary" disabled={busy || !wanted.trim()}>Connect</button>
    </form>
  {:else}
    <Row title="None" description="Owners and admins can connect one." />
  {/if}
</Group>

<Confirm bind:open={removing} title="Stop serving links on {domain?.domain}?" confirm="Remove" danger onconfirm={() => run(() => api.put(endpoints.publisherDomain(publisher), { domain: null }))}>
  <p>Links on it stop working at once. Links on dl.schelf.store/{slug} keep working.</p>
</Confirm>

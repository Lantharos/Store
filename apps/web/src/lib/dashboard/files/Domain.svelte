<script lang="ts">
  import type { AppSettings } from "@schelf/protocol"
  import CopyButton from "../../code/CopyButton.svelte"
  import { ago } from "../../format.ts"
  import Group from "../../ui/group/Group.svelte"
  import Row from "../../ui/group/Row.svelte"
  import { toasts } from "../../ui/overlay/toasts.svelte.ts"
  import { api } from "../api/client.ts"
  import { endpoints } from "../api/endpoints.ts"
  import { session } from "../api/session.svelte.ts"
  import { schelfFile } from "./files.ts"

  let { settings = $bindable() }: { settings: AppSettings } = $props()
  const domain = $derived(settings.app.domain)
  const file = $derived(schelfFile(settings) ?? "schelf.toml")
  let checking = $state(false)

  const STATUS = {
    proving: "Waiting for its DNS records",
    connecting: "Connecting",
    active: "Serving your links",
    paused: "Paused",
  }

  async function check() {
    checking = true
    try {
      settings = await api.post<AppSettings>(endpoints.checkDomain(settings.app.id))
    } catch (error) {
      toasts.error(error)
    } finally {
      checking = false
    }
  }
</script>

{#if domain}
  <Group title="Custom domain" rows>
    <Row title={domain.domain} description={domain.waiting ?? STATUS[domain.status]}>
      <span class="font-mono text-[12px] text-ink-muted">{file} · domain</span>
    </Row>
    {#if domain.status === "proving" || domain.status === "connecting"}
      {#each domain.records as record (record.type)}
        <Row title="{record.type} {record.name}">
          <code class="max-w-64 truncate font-mono text-[13px] text-ink-soft">{record.value}</code>
          <CopyButton text={record.value} label="Copy the {record.type} value" compact />
        </Row>
      {/each}
      {#if session.can("apps")}
        <Row title="Checked {domain.checked_at ? ago(domain.checked_at) : 'never'}" description="Schelf looks again every hour.">
          <button type="button" class="button button-sm button-quiet" disabled={checking} onclick={check}>Check now</button>
        </Row>
      {/if}
    {/if}
  </Group>
{/if}

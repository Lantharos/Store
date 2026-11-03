<script lang="ts">
  import CircleCheck from "@lucide/svelte/icons/circle-check"
  import LoaderCircle from "@lucide/svelte/icons/loader-circle"
  import type { Namespace } from "@schelf/protocol"
  import { untrack } from "svelte"
  import CopyButton from "../../code/CopyButton.svelte"
  import { ago } from "../../format.ts"
  import Segmented from "../../ui/fields/Segmented.svelte"
  import { api } from "../api/client.ts"
  import { endpoints } from "../api/endpoints.ts"

  let { namespace, onverified }: { namespace: Namespace; onverified: (namespace: Namespace) => void } =
    $props()

  const POLL = 20_000
  let method = $state<"dns" | "well-known">("dns")
  let checking = $state(false)
  let current = $state(untrack(() => namespace))
  let failed = $state<string | null>(null)
  const domain = $derived(current.prefix.split(".").reverse().join("."))

  async function check() {
    checking = true
    failed = null
    try {
      current = await api.post<Namespace>(endpoints.verifyNamespace(current.prefix), { method })
      if (current.verified) onverified(current)
      else
        failed =
          method === "dns"
            ? `We couldn't find the TXT record on ${domain} yet.`
            : `We couldn't read the file on ${domain} yet.`
    } catch (error) {
      failed = (error as Error).message
    } finally {
      checking = false
    }
  }

  $effect(() => {
    if (current.verified) return
    const timer = setInterval(() => document.visibilityState === "visible" && !checking && void check(), POLL)
    return () => clearInterval(timer)
  })
</script>

{#if current.verified}
  <p class="flex items-center gap-2 text-[15px]"><CircleCheck class="size-[18px] text-accent" />{current.prefix} is yours.</p>
{:else}
  <div class="space-y-4">
    <Segmented bind:value={method} label="How to prove it" size="sm" options={[{ value: "dns", label: "DNS record" }, { value: "well-known", label: "File on your site" }]} />
    {#if method === "dns"}
      <p class="text-[15px] leading-relaxed text-ink-soft">Add a TXT record to <span class="font-mono text-[14px] text-ink">{domain}</span> with this value:</p>
      <div class="flex items-center gap-2 rounded-2xl bg-well py-2 pr-2 pl-4">
        <code class="min-w-0 flex-1 truncate font-mono text-[13px]">{current.instructions?.dns ?? current.token}</code>
        <CopyButton text={current.instructions?.dns ?? current.token} />
      </div>
    {:else}
      <p class="text-[15px] leading-relaxed text-ink-soft">Serve this text as the whole file at:</p>
      <div class="flex items-center gap-2 rounded-2xl bg-well py-2 pr-2 pl-4">
        <code class="min-w-0 flex-1 truncate font-mono text-[13px]">{current.instructions?.well_known}</code>
        <CopyButton text={current.instructions?.well_known ?? ""} label="Copy address" />
      </div>
      <div class="flex items-center gap-2 rounded-2xl bg-well py-2 pr-2 pl-4">
        <code class="min-w-0 flex-1 truncate font-mono text-[13px]">{current.token}</code>
        <CopyButton text={current.token} />
      </div>
    {/if}
    <div class="flex flex-wrap items-center gap-3">
      <button type="button" class="button button-sm button-primary" onclick={check} disabled={checking}>
        {#if checking}<LoaderCircle class="size-3.5 animate-spin" />Checking{:else}Check again{/if}
      </button>
      <p class="text-[13px] text-ink-muted" role="status">
        {failed ?? (current.checked_at ? `Last checked ${ago(current.checked_at)}. We keep checking while this page is open.` : "We keep checking while this page is open.")}
      </p>
    </div>
  </div>
{/if}

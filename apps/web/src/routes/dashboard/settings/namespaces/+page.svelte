<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down"
  import { claimNamespace, type Namespace } from "@schelf/protocol"
  import { api } from "#lib/dashboard/api/client.ts"
  import { endpoints } from "#lib/dashboard/api/endpoints.ts"
  import { resource } from "#lib/dashboard/api/resource.svelte.ts"
  import { session } from "#lib/dashboard/api/session.svelte.ts"
  import Proof from "#lib/dashboard/namespaces/Proof.svelte"
  import Failed from "#lib/dashboard/shell/Failed.svelte"
  import Loading from "#lib/dashboard/shell/Loading.svelte"
  import PageHeader from "#lib/dashboard/shell/PageHeader.svelte"
  import { date } from "#lib/format.ts"
  import Group from "#lib/ui/group/Group.svelte"
  import { toasts } from "#lib/ui/overlay/toasts.svelte.ts"

  const namespaces = $derived(resource<Namespace[]>(endpoints.namespaces(session.publisher!.id)))
  let prefix = $state("")
  let error = $state<string | null>(null)
  let busy = $state(false)
  let open = $state<string | null>(null)

  const PROOFS = {
    github: "GitHub sign-in",
    dns: "DNS record",
    "well-known": "File on your site",
    manual: "Schelf",
  } as const

  async function claim(event: SubmitEvent) {
    event.preventDefault()
    const parsed = claimNamespace.safeParse({ prefix })
    if (!parsed.success) {
      error = parsed.error.issues[0]!.message
      return
    }
    busy = true
    error = null
    try {
      const created = await api.post<Namespace>(endpoints.namespaces(session.publisher!.id), parsed.data)
      namespaces.set([...(namespaces.data ?? []), created])
      open = created.prefix
      prefix = ""
    } catch (failure) {
      error = (failure as Error).message
    } finally {
      busy = false
    }
  }

  function verified(next: Namespace) {
    namespaces.set((namespaces.data ?? []).map((item) => (item.prefix === next.prefix ? next : item)))
    toasts.show(`${next.prefix} is yours`)
  }
</script>

<PageHeader title="Namespaces" text="{session.publisher?.name} can publish app ids under any namespace it has proven. GitHub namespaces are proven when you sign in with GitHub; for a domain, add a DNS record or a file." />

<div class="mt-8 space-y-10">
  {#if session.can("apps")}
    <Group title="Claim a namespace" description="Your domain, reversed: example.com becomes com.example.">
      <form class="flex flex-col gap-2 sm:flex-row" onsubmit={claim}>
        <input bind:value={prefix} class="field font-mono text-[15px]" placeholder="com.example" aria-label="Namespace" autocomplete="off" spellcheck="false" />
        <button class="button button-primary shrink-0" disabled={busy || !prefix.trim()}>Claim</button>
      </form>
      {#if error}<p class="-mt-3 text-[15px] text-danger" role="alert">{error}</p>{/if}
    </Group>
  {/if}

  {#if namespaces.error}
    <Failed error={namespaces.error} retry={() => namespaces.refresh()} />
  {:else if !namespaces.data}
    <Loading />
  {:else}
    <Group title="Your namespaces" rows>
      {#each namespaces.data as namespace (namespace.prefix)}
        {@const expanded = open === namespace.prefix || (!namespace.verified && open === null)}
        <div>
          <button type="button" class="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-well/50" aria-expanded={expanded} onclick={() => (open = expanded ? "" : namespace.prefix)}>
            <span class="size-2 shrink-0 rounded-full {namespace.verified ? 'bg-accent' : 'bg-caution'}"></span>
            <span class="min-w-0 flex-1">
              <span class="block truncate font-mono text-[15px]">{namespace.prefix}.*</span>
              <span class="block text-[13px] text-ink-muted">
                {#if namespace.verified}Proven by {namespace.proof ? PROOFS[namespace.proof] : "Schelf"}{namespace.verified_at ? ` on ${date(namespace.verified_at)}` : ""}{:else}Waiting for proof{/if}
              </span>
            </span>
            <ChevronDown class="size-4 text-ink-muted transition-transform {expanded ? 'rotate-180' : ''}" />
          </button>
          {#if expanded}
            <div class="px-5 pb-5 pl-11">
              {#if namespace.verified}
                <p class="text-[15px] leading-relaxed text-ink-soft">Checked again every month{namespace.checked_at ? `, last on ${date(namespace.checked_at)}` : ""}. If the proof goes away, your apps stay listed but new releases wait until it's back.</p>
              {:else}
                <Proof {namespace} onverified={verified} />
              {/if}
            </div>
          {/if}
        </div>
      {:else}
        <p class="px-5 py-5 text-[15px] text-ink-muted">No namespaces yet. Claim one above, or sign in with GitHub to get io.github.yourname.</p>
      {/each}
    </Group>
  {/if}
</div>

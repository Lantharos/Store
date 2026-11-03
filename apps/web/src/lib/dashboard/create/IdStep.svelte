<script lang="ts">
  import CircleCheck from "@lucide/svelte/icons/circle-check"
  import { appId, type Namespace, namespaceCovers } from "@schelf/protocol"
  import Field from "../../ui/fields/Field.svelte"
  import { api } from "../api/client.ts"
  import { endpoints } from "../api/endpoints.ts"
  import type { Resource } from "../api/resource.svelte.ts"
  import { session } from "../api/session.svelte.ts"
  import Proof from "../namespaces/Proof.svelte"

  let {
    id = $bindable(),
    namespaces,
    ready = $bindable(false),
  }: { id: string; namespaces: Resource<Namespace[]>; ready?: boolean } = $props()

  let claiming = $state(false)
  let claimError = $state<string | null>(null)

  const valid = $derived(appId.safeParse(id))
  const covering = $derived(
    valid.success
      ? (namespaces.data ?? []).find((namespace) => namespaceCovers(namespace.prefix, id))
      : undefined,
  )
  const prefix = $derived(id.split(".").slice(0, -1).join(".").toLowerCase())

  $effect(() => {
    ready = valid.success && covering?.verified === true
  })

  async function claim() {
    claiming = true
    claimError = null
    try {
      const created = await api.post<Namespace>(endpoints.namespaces(session.publisher!.id), { prefix })
      namespaces.set([...(namespaces.data ?? []), created])
    } catch (error) {
      claimError = (error as Error).message
    } finally {
      claiming = false
    }
  }

  function verified(next: Namespace) {
    namespaces.set((namespaces.data ?? []).map((item) => (item.prefix === next.prefix ? next : item)))
  }
</script>

<div class="space-y-6">
  <Field label="App id" hint="The same id as in Sabine.toml, your AppStream file and desktop entry. It can't change after the first release." error={id && !valid.success ? valid.error.issues[0]?.message : null}>
    <input bind:value={id} class="field font-mono text-[15px]" spellcheck="false" autocomplete="off" placeholder="io.github.you.Notes" />
  </Field>

  {#if valid.success}
    {#if covering?.verified}
      <p class="flex items-center gap-2 text-[15px] text-ink-soft"><CircleCheck class="size-[18px] text-accent" />It's under <span class="font-mono text-[14px] text-ink">{covering.prefix}</span>, which is yours.</p>
    {:else if covering}
      <div class="rounded-2xl bg-well/60 p-5">
        <p class="mb-4 text-[15px]">Prove <span class="font-mono text-[14px]">{covering.prefix}</span> is yours to continue.</p>
        <Proof namespace={covering} onverified={verified} />
      </div>
    {:else}
      <div class="rounded-2xl bg-well/60 p-5">
        <p class="text-[15px] leading-relaxed">
          You haven't proven <span class="font-mono text-[14px]">{prefix}</span> yet.
          {#if prefix.startsWith("io.github.")}Sign in with that GitHub account, or claim it if it's an organisation you own.{:else}Claim it and add a DNS record or a file to your site.{/if}
        </p>
        <button type="button" class="button button-sm button-primary mt-4" onclick={claim} disabled={claiming}>Claim {prefix}</button>
        {#if claimError}<p class="mt-2 text-[15px] text-danger">{claimError}</p>{/if}
      </div>
    {/if}
  {/if}
</div>

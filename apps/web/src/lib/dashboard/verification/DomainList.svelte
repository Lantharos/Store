<script lang="ts">
  import CircleCheck from "@lucide/svelte/icons/circle-check"
  import CircleDashed from "@lucide/svelte/icons/circle-dashed"
  import LoaderCircle from "@lucide/svelte/icons/loader-circle"
  import X from "@lucide/svelte/icons/x"
  import { domainName, MAX_DOMAINS, type Verification } from "@schelf/protocol"
  import CopyButton from "../../code/CopyButton.svelte"
  import type { VerificationFlow } from "./verification.svelte.ts"

  let {
    flow,
    verification,
    editable,
  }: { flow: VerificationFlow; verification: Verification; editable: boolean } = $props()

  const PROOFS = {
    namespace: "Proven through your namespace",
    dns: "Proven by its DNS record",
    "well-known": "Proven by the file on the site",
  }
  let adding = $state("")
  let error = $state<string | null>(null)
  const names = $derived(verification.domains.map((domain) => domain.name))
  const unproven = $derived(verification.domains.filter((domain) => !domain.proof))

  async function add(event: SubmitEvent) {
    event.preventDefault()
    const parsed = domainName.safeParse(adding.replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
    if (!parsed.success) {
      error = parsed.error.issues[0]!.message
      return
    }
    error = null
    if (await flow.save({ domains: [...names, parsed.data] })) adding = ""
  }
</script>

{#if names.length}
  <ul class="divide-y divide-hairline">
    {#each verification.domains as domain (domain.name)}
      <li class="flex items-center gap-3 py-3">
        {#if domain.proof}
          <CircleCheck class="size-[18px] shrink-0 text-accent" />
        {:else}
          <CircleDashed class="size-[18px] shrink-0 text-ink-muted" />
        {/if}
        <div class="min-w-0 flex-1">
          <p class="truncate font-medium">{domain.name}</p>
          <p class="text-[13px] text-ink-muted">{domain.proof ? PROOFS[domain.proof] : "Not proven yet"}</p>
        </div>
        {#if editable}
          <button type="button" class="button size-8 p-0 text-ink-muted hover:bg-well hover:text-ink" aria-label="Remove {domain.name}" onclick={() => flow.save({ domains: names.filter((name) => name !== domain.name) })}>
            <X class="size-4" />
          </button>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

{#if editable && names.length < MAX_DOMAINS}
  <form class="flex gap-2" onsubmit={add}>
    <input bind:value={adding} class="field" placeholder="example.com" aria-label="Add a domain" autocomplete="off" spellcheck="false" />
    <button class="button button-quiet shrink-0" disabled={!adding.trim() || flow.busy !== null}>Add</button>
  </form>
  {#if error}<p class="mt-2 text-[13px] text-danger" role="alert">{error}</p>{/if}
{/if}

{#if editable && unproven.length}
  <div class="mt-5 space-y-3 rounded-2xl bg-well p-4 text-[15px] leading-relaxed">
    <p class="text-ink-soft">Prove {unproven.length === 1 ? unproven[0]!.name : "each domain"} with a TXT record holding this value, or a file at <span class="font-mono text-[13px] text-ink">/.well-known/schelf-store.txt</span> containing it:</p>
    <div class="flex items-center gap-2 rounded-xl bg-raised py-1.5 pr-1.5 pl-3">
      <code class="min-w-0 flex-1 truncate font-mono text-[13px]">schelf-verify={verification.proof_token}</code>
      <CopyButton text="schelf-verify={verification.proof_token}" />
    </div>
    <button type="button" class="button button-sm button-quiet bg-raised" disabled={flow.busy !== null} onclick={() => flow.check()}>
      {#if flow.busy === "check"}<LoaderCircle class="size-3.5 animate-spin" />Checking{:else}Check again{/if}
    </button>
  </div>
{/if}

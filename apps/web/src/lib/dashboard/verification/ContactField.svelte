<script lang="ts">
  import CircleCheck from "@lucide/svelte/icons/circle-check"
  import type { Verification } from "@schelf/protocol"
  import { untrack } from "svelte"
  import CodeField from "../account/CodeField.svelte"
  import type { VerificationFlow } from "./verification.svelte.ts"

  let {
    flow,
    verification,
    editable,
  }: { flow: VerificationFlow; verification: Verification; editable: boolean } = $props()

  let email = $state(untrack(() => verification.contact_email ?? ""))
  let sent = $state(false)
  let code = $state("")
  const saved = $derived(email.trim().toLowerCase() === (verification.contact_email ?? ""))

  async function send() {
    if (!saved && !(await flow.save({ contact_email: email.trim() || null }))) return
    if (await flow.sendCode()) {
      sent = true
      code = ""
    }
  }

  async function confirm(entered: string) {
    if (await flow.confirm(entered)) sent = false
    else code = ""
  }
</script>

{#if verification.contact_confirmed && saved}
  <div class="flex items-center gap-3">
    <CircleCheck class="size-[18px] shrink-0 text-accent" />
    <p class="min-w-0 flex-1 truncate">{verification.contact_email}</p>
    {#if editable}<button type="button" class="text-[15px] text-ink-muted hover:text-ink" onclick={() => ((email = ""), flow.save({ contact_email: null }))}>Change</button>{/if}
  </div>
{:else}
  <div class="flex flex-col gap-2 sm:flex-row">
    <input bind:value={email} type="email" class="field" placeholder="you@example.com" aria-label="Contact email" autocomplete="email" disabled={!editable} />
    {#if editable}
      <button type="button" class="button button-quiet shrink-0" disabled={!email.trim() || flow.busy !== null} onclick={send}>{sent ? "Send again" : "Send a code"}</button>
    {/if}
  </div>
  {#if sent}
    <p class="mt-4 text-[15px] text-ink-soft">Enter the code we sent to <span class="text-ink">{verification.contact_email}</span>.</p>
    <div class="mt-3"><CodeField bind:value={code} oncomplete={confirm} /></div>
  {/if}
{/if}

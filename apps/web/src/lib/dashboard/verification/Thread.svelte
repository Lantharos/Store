<script lang="ts">
  import type { Verification } from "@schelf/protocol"
  import { ago } from "../../format.ts"
  import type { VerificationFlow } from "./verification.svelte.ts"

  let {
    flow,
    verification,
    canReply,
  }: { flow: VerificationFlow; verification: Verification; canReply: boolean } = $props()
  let text = $state("")

  async function send(event: SubmitEvent) {
    event.preventDefault()
    if (await flow.reply(text.trim())) text = ""
  }
</script>

{#if verification.messages.length}
  <ol class="space-y-5">
    {#each verification.messages as message (message.at)}
      <li class={message.from === "store" ? "" : "pl-6 sm:pl-12"}>
        <p class="text-[13px] text-ink-muted">
          <span class="font-medium text-ink-soft">{message.from === "store" ? "Schelf review" : message.name}</span> · {ago(message.at)}
        </p>
        <p class="mt-1.5 rounded-2xl px-4 py-3 text-[15px] leading-relaxed whitespace-pre-line {message.from === 'store' ? 'bg-[color-mix(in_oklab,var(--accent)_12%,var(--canvas))]' : 'bg-well'}">{message.text}</p>
      </li>
    {/each}
  </ol>
{/if}

{#if canReply}
  <form class="mt-5 space-y-3" onsubmit={send}>
    <textarea bind:value={text} class="field h-32 resize-y py-3 leading-relaxed" maxlength="5000" placeholder="Answer here. Change the details above first if that's what was asked." aria-label="Your answer"></textarea>
    <button class="button button-primary" disabled={!text.trim() || flow.busy !== null}>Send answer</button>
  </form>
{/if}

<script lang="ts">
  import type { VerificationFlow } from "./verification.svelte.ts"

  let { flow }: { flow: VerificationFlow } = $props()
  let text = $state("")

  async function send(event: SubmitEvent) {
    event.preventDefault()
    if (await flow.reply(text.trim())) text = ""
  }
</script>

<form class="space-y-3" onsubmit={send}>
  <textarea bind:value={text} class="field h-32 resize-y py-3 leading-relaxed" maxlength="5000" placeholder="Your answer" aria-label="Your answer"></textarea>
  <button class="button button-primary" disabled={!text.trim() || flow.busy !== null}>Send answer</button>
</form>

<script lang="ts">
  import Activity from "@lucide/svelte/icons/activity"
  import Megaphone from "@lucide/svelte/icons/megaphone"
  import Sparkles from "@lucide/svelte/icons/sparkles"
  import { AI_WORDS, adsWords, type Privacy, TELEMETRY_WORDS } from "@schelf/protocol"

  let { privacy }: { privacy: Privacy } = $props()

  const lines = $derived([
    { icon: Activity, text: TELEMETRY_WORDS[privacy.telemetry], notable: privacy.telemetry === "opt-out" },
    { icon: Megaphone, text: adsWords(privacy.ads), notable: privacy.ads },
    { icon: Sparkles, text: AI_WORDS[privacy.ai], notable: privacy.ai === "online" },
  ])
</script>

<section aria-labelledby="privacy">
  <h2 id="privacy" class="font-semibold">Privacy</h2>
  <ul class="mt-3 space-y-2.5 text-[15px] text-ink-soft">
    {#each lines as line (line.text)}
      <li class="flex gap-3">
        <line.icon class="mt-0.5 size-[18px] shrink-0 {line.notable ? 'text-caution' : 'text-ink-muted'}" />
        <span class={line.notable ? "text-ink" : ""}>{line.text}</span>
      </li>
    {/each}
  </ul>
  <p class="mt-2.5 text-[13px] text-ink-muted">As the developer declares it.</p>
</section>

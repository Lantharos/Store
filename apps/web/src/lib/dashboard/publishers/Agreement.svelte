<script lang="ts">
  import Checkbox from "../../ui/fields/Checkbox.svelte"

  let { agreed = $bindable(false), on = "you" }: { agreed?: boolean; on?: string } = $props()
</script>

<div class="space-y-5">
  <div class="rounded-2xl bg-well p-4 text-[15px] leading-relaxed text-ink-soft">
    <p>In short, {on === "you" ? "you agree" : `you agree for ${on}`} that:</p>
    <ul class="mt-2 list-disc space-y-1 pl-5">
      <li>{on === "you" ? "you own" : "it owns"} what {on === "you" ? "you publish" : "it publishes"}, and its licence is true;</li>
      <li>you'll tell us within 72 hours if an account is compromised;</li>
      <li>Schelf may host, check, sign and, when it's harmful, stop {on === "you" ? "your" : "its"} apps.</li>
    </ul>
  </div>
  <Checkbox bind:checked={agreed}>
    I accept the <a href="/legal/developer-agreement" target="_blank" class="link">developer agreement</a>{on === "you" ? "" : ` on behalf of ${on}`}
  </Checkbox>
</div>

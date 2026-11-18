<script lang="ts">
  import { AI_WORDS, type AppSettings, adsWords, TELEMETRY_WORDS } from "@schelf/protocol"
  import Group from "../../ui/group/Group.svelte"
  import Row from "../../ui/group/Row.svelte"
  import { schelfFile } from "./files.ts"

  let { settings }: { settings: AppSettings } = $props()
  const privacy = $derived(settings.app.privacy)
  const file = $derived(schelfFile(settings) ?? "schelf.toml")
</script>

<Group title="Privacy" rows>
  {#if privacy}
    <Row title={TELEMETRY_WORDS[privacy.telemetry]}><span class="font-mono text-[12px] text-ink-muted">{file} · privacy.telemetry</span></Row>
    <Row title={adsWords(privacy.ads)}><span class="font-mono text-[12px] text-ink-muted">{file} · privacy.ads</span></Row>
    <Row title={AI_WORDS[privacy.ai]}><span class="font-mono text-[12px] text-ink-muted">{file} · privacy.ai</span></Row>
  {:else}
    <Row title="Not declared" description="Say in schelf.toml whether the app sends usage data, shows ads or has AI features, and the page shows it." />
  {/if}
</Group>

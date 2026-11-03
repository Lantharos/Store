<script lang="ts">
  import type { AppSettings } from "@schelf/protocol"
  import CodeBlock from "../../code/CodeBlock.svelte"
  import CopyButton from "../../code/CopyButton.svelte"
  import Group from "../../ui/group/Group.svelte"
  import Row from "../../ui/group/Row.svelte"
  import { session } from "../api/session.svelte.ts"
  import { feedSetup, frameworkName } from "./framework.ts"

  let { settings }: { settings: AppSettings } = $props()
  const app = $derived(settings.app)
  const moving = $derived(settings.switches.some((entry) => !entry.completed_at))
  const current = $derived(settings.links.feeds.find((feed) => feed.updater === app.updater))
  const setup = $derived(app.updater && current ? feedSetup(app.updater, current.url) : null)
  const DESCRIPTIONS = {
    sabine: "The app checks Schelf's signed feed and updates itself on every system.",
    electron: "The app reads its feed from Schelf, and follows each release's rollout.",
    tauri: "The app reads its feed from Schelf, signed with your own updater key.",
  }
</script>

<Group title="How it updates" rows>
  <Row title={frameworkName(app.updater)} description={app.updater ? DESCRIPTIONS[app.updater] : "People download each new version themselves, from your links."}>
    {#if !moving && session.can("apps")}
      <a href="/dashboard/apps/{app.id}/updates/move" class="button button-sm button-quiet">{app.updater ? "Change" : "Add an updater"}</a>
    {/if}
  </Row>
  {#each settings.links.feeds as feed (feed.url)}
    <Row title={settings.links.feeds.length > 1 ? `${frameworkName(feed.updater)} feed` : "Feed"}>
      <CopyButton text={feed.url} label="Copy" />
      {#snippet below()}<p class="truncate font-mono text-[13px] text-ink-soft">{feed.url}</p>{/snippet}
    </Row>
  {/each}
</Group>

{#if setup}
  <section class="mt-6">
    <p class="px-1 text-[15px] text-ink-soft">Point the app at it in {setup.file}:</p>
    <div class="mt-3"><CodeBlock title={setup.file} lang={setup.lang} code={setup.code} /></div>
  </section>
{/if}

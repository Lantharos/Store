<script lang="ts">
  import type { AppSettings } from "@schelf/protocol"
  import Switch from "../../ui/fields/Switch.svelte"
  import Group from "../../ui/group/Group.svelte"
  import Row from "../../ui/group/Row.svelte"
  import { session } from "../api/session.svelte.ts"
  import { saveHosting } from "./save.ts"

  let { settings = $bindable() }: { settings: AppSettings } = $props()
  const app = $derived(settings.app)
  let slug = $state(settings.app.slug)
  let saving = $state(false)

  async function save(event: SubmitEvent) {
    event.preventDefault()
    saving = true
    settings = await saveHosting(settings, { slug })
    saving = false
  }
</script>

<Group title="Links" rows>
  {#if session.can("apps")}
    <Row title="Address" description="Its page and download links. Changing it changes every link, and old ones stop working.">
      {#snippet below()}
        <form class="mt-2 flex flex-wrap items-center gap-2" onsubmit={save}>
          <div class="field flex h-10 min-w-0 flex-1 items-center font-mono text-[14px] focus-within:shadow-[0_0_0_2px_var(--accent)] sm:max-w-sm">
            <span class="shrink-0 text-ink-muted">{app.publisher_slug}/</span>
            <input class="min-w-0 flex-1 bg-transparent outline-none" bind:value={slug} spellcheck="false" aria-label="Address" />
          </div>
          <button class="button button-sm button-quiet" disabled={saving || slug === app.slug || !slug}>Save</button>
        </form>
      {/snippet}
    </Row>
  {/if}
  {#if app.kind !== "extension"}
    <Row title="Links follow the rollout" description="Off, download links wait until a release reaches everyone. On, they hand it out to the same share of people as it rolls out.">
      <Switch label="Links follow the rollout" checked={app.latest_follows_rollout} onchange={async (latest_follows_rollout) => (settings = await saveHosting(settings, { latest_follows_rollout }))} />
    </Row>
  {/if}
</Group>

<script lang="ts">
  import type { AppSettings, UpdateHosting } from "@schelf/protocol"
  import Switch from "../../ui/fields/Switch.svelte"
  import Group from "../../ui/group/Group.svelte"
  import Row from "../../ui/group/Row.svelte"
  import Confirm from "../../ui/overlay/Confirm.svelte"
  import { toasts } from "../../ui/overlay/toasts.svelte.ts"
  import { api } from "../api/client.ts"
  import { endpoints } from "../api/endpoints.ts"
  import { session } from "../api/session.svelte.ts"

  let { settings = $bindable() }: { settings: AppSettings } = $props()
  const app = $derived(settings.app)
  let asking = $state(false)
  let slug = $state(settings.app.slug)

  async function save(change: UpdateHosting) {
    try {
      settings = await api.patch<AppSettings>(endpoints.hosting(app.id), change)
      await session.refreshApps()
    } catch (error) {
      toasts.show((error as Error).message, "danger")
      settings = { ...settings }
    }
  }

  async function askToList() {
    settings = await api.post<AppSettings>(endpoints.listingRequest(app.id))
  }
</script>

<Group title="Who finds it" rows>
  <Row
    title={app.visibility === "listed" ? "Listed" : app.listing_requested ? "Waiting to be listed" : "Unlisted"}
    description={app.visibility === "listed"
      ? "It's in the catalog, search and the Schelf app, and a person reviews each release."
      : app.listing_requested
        ? "A reviewer is looking at the project and its latest release. You'll get an email when they decide."
        : "Only people with the link find it. Releases from GitHub Actions go out once Schelf's checks pass."}
  >
    {#if app.visibility === "unlisted" && !app.listing_requested && session.can("apps")}
      <button type="button" class="button button-sm button-quiet" onclick={() => (asking = true)}>Ask to be listed</button>
    {/if}
  </Row>
  {#if app.visibility === "unlisted"}
    <Row title="Let search engines show the page" description="Off, the page asks them not to.">
      <Switch label="Let search engines show the page" checked={app.page_indexed} onchange={(page_indexed) => save({ page_indexed })} />
    </Row>
  {/if}
  <Row
    title="Download links follow the rollout"
    description="Off, links wait until a release has reached everyone. On, a new release is handed out to the same share of visitors as it rolls out."
  >
    <Switch label="Download links follow the rollout" checked={app.latest_follows_rollout} onchange={(latest_follows_rollout) => save({ latest_follows_rollout })} />
  </Row>
  {#if session.can("apps")}
    <Row title="Address" description="Changing it changes every link above.">
      <form class="flex items-center gap-2" onsubmit={(event) => (event.preventDefault(), save({ slug }))}>
        <span class="font-mono text-[13px] text-ink-muted">{app.publisher_slug}/</span>
        <input class="field h-9 w-40 font-mono text-[14px]" bind:value={slug} spellcheck="false" aria-label="Address" />
        <button class="button button-sm button-quiet" disabled={slug === app.slug || !slug}>Save</button>
      </form>
    </Row>
  {/if}
</Group>

<Confirm bind:open={asking} title="Ask to list {app.name}?" confirm="Ask to be listed" onconfirm={askToList}>
  <p class="text-[15px] leading-relaxed text-ink-soft">
    A person reviews the project and its latest release. Once it's listed, it shows up in the catalog, in search and in the Schelf app, and every release is reviewed before it goes out. Its links and updates keep working the whole time.
  </p>
</Confirm>

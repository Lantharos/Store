<script lang="ts">
  import type { AppSettings } from "@schelf/protocol"
  import Switch from "../../ui/fields/Switch.svelte"
  import Group from "../../ui/group/Group.svelte"
  import Row from "../../ui/group/Row.svelte"
  import Confirm from "../../ui/overlay/Confirm.svelte"
  import { api } from "../api/client.ts"
  import { endpoints } from "../api/endpoints.ts"
  import { session } from "../api/session.svelte.ts"
  import { listingFile } from "../files/files.ts"
  import { saveHosting } from "./save.ts"

  let { settings = $bindable() }: { settings: AppSettings } = $props()
  const app = $derived(settings.app)
  const file = $derived(listingFile(settings))
  const onlyParts = $derived(!app.platforms && Object.keys(app.parts).length > 0)
  let asking = $state(false)

  async function askToList() {
    settings = await api.post<AppSettings>(endpoints.listingRequest(app.id))
  }
</script>

<Group title="Who finds it" rows>
  <Row
    title={app.visibility === "listed" ? "Listed" : app.listing_requested ? "Waiting to be listed" : "Unlisted"}
    description={app.visibility === "listed"
      ? "In the store, in search and in Schelf on Luft. A person reviews every release."
      : app.listing_requested
        ? "A reviewer is looking at the project and its latest release. You'll get an email when they decide."
        : onlyParts
          ? "It hosts the downloads of its parts and isn't listed. Releases from GitHub go out once Schelf's checks pass."
          : "Only people with the link find it. Releases from GitHub go out once Schelf's checks pass."}
  >
    {#if file}
      <span class="font-mono text-[12px] text-ink-muted">{file} · listed</span>
    {:else if app.visibility === "unlisted" && !app.listing_requested && !onlyParts && session.can("apps")}
      <button type="button" class="button button-sm button-quiet" onclick={() => (asking = true)}>Ask to be listed</button>
    {/if}
  </Row>
  {#if app.visibility === "unlisted"}
    <Row title="Show the page in search engines" description="Off, the page asks them to leave it out.">
      {#if file}
        <span class="text-[15px] text-ink-soft">{app.page_indexed ? "On" : "Off"}<span class="ml-2 font-mono text-[12px] text-ink-muted">{file} · indexed</span></span>
      {:else}
        <Switch label="Show the page in search engines" checked={app.page_indexed} onchange={async (page_indexed) => (settings = await saveHosting(settings, { page_indexed }))} />
      {/if}
    </Row>
  {/if}
</Group>

<Confirm bind:open={asking} title="Ask to list {app.name}?" confirm="Ask to be listed" onconfirm={askToList}>
  <p class="text-[15px] leading-relaxed text-ink-soft">
    A person reviews the project and its latest release. Once it's listed, it shows up in the store, in search and in Schelf on Luft, and every release is reviewed before it goes out. Its links and updates keep working the whole time.
  </p>
</Confirm>

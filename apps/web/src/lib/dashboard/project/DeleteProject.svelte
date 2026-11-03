<script lang="ts">
  import { type AppSettings, type DeletedProject, isProjectId } from "@schelf/protocol"
  import { goto } from "$app/navigation"
  import Group from "../../ui/group/Group.svelte"
  import Row from "../../ui/group/Row.svelte"
  import Confirm from "../../ui/overlay/Confirm.svelte"
  import { toasts } from "../../ui/overlay/toasts.svelte.ts"
  import { api } from "../api/client.ts"
  import { endpoints } from "../api/endpoints.ts"
  import { forget } from "../api/resource.svelte.ts"
  import { session } from "../api/session.svelte.ts"

  let { settings }: { settings: AppSettings } = $props()
  const app = $derived(settings.app)
  const shipped = $derived(app.status !== "draft" && app.status !== "in-review")
  const name = $derived(app.name)
  const handle = $derived(isProjectId(app.id) ? `${app.publisher_slug}/${app.slug}` : app.id)
  let open = $state(false)
  let typed = $state("")

  async function remove() {
    const deleted = await api.delete<DeletedProject>(endpoints.app(app.id))
    forget(endpoints.app(app.id))
    await session.refreshApps()
    toasts.show(
      deleted.restorable_until ? `${name} is deleted. You can restore it for 30 days.` : `${name} is deleted`,
    )
    await goto("/dashboard")
  }
</script>

<Group rows>
  <Row
    title="Delete {name}"
    description={shipped
      ? "Its page, links and updates stop at once. People who have it keep the version they have. You can restore it for 30 days."
      : "Nothing has been released, so it's removed right away, with everything you've set up."}
  >
    <button type="button" class="button button-sm button-danger" onclick={() => ((typed = ""), (open = true))}>Delete</button>
  </Row>
</Group>

<Confirm bind:open title="Delete {name}?" confirm="Delete {name}" danger ready={typed === name} onconfirm={remove}>
  {#if shipped}
    <p>Its listing, page, download links and update feeds go away now, and nobody new can get it.</p>
    <p class="mt-3">People who already have it keep it, and it keeps working. It just won't update anymore, and nothing stops it.</p>
    <p class="mt-3">For 30 days you can restore it from your projects, as it was. After that its files are removed for good, and {handle} stays yours, so nobody else can ship an update to it.</p>
  {:else}
    <p>Nothing has been released, so it's removed right away: the listing, any uploads, trusted publishers and tokens. Its id and address are free to use again.</p>
  {/if}
  <p class="mt-5">Type its name to confirm.</p>
  <input bind:value={typed} class="field mt-3" placeholder={name} aria-label="The project's name" autocomplete="off" />
</Confirm>

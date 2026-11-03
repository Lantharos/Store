<script lang="ts">
  import type { RestorableProject } from "@schelf/protocol"
  import { date } from "../../format.ts"
  import Group from "../../ui/group/Group.svelte"
  import Row from "../../ui/group/Row.svelte"
  import { toasts } from "../../ui/overlay/toasts.svelte.ts"
  import { api } from "../api/client.ts"
  import { endpoints } from "../api/endpoints.ts"
  import { resource } from "../api/resource.svelte.ts"
  import { session } from "../api/session.svelte.ts"

  let { publisherId }: { publisherId: string } = $props()
  const deleted = $derived(resource<RestorableProject[]>(endpoints.deletedProjects(publisherId)))
  let restoring = $state<string | null>(null)

  async function restore(project: RestorableProject) {
    restoring = project.id
    try {
      await api.post(endpoints.restore(project.id))
      deleted.set(deleted.data!.filter((entry) => entry.id !== project.id))
      await session.refreshApps()
      toasts.show(`${project.name} is back`)
    } catch (error) {
      toasts.error(error)
    } finally {
      restoring = null
    }
  }
</script>

{#if deleted.data?.length}
  <Group class="mt-12" title="Recently deleted" description="People who have these keep them, without updates. Restore one to bring back its page, links and updates." rows>
    {#each deleted.data as project (project.id)}
      <Row title={project.name} description="Its files are removed for good on {date(project.restorable_until)}.">
        <button type="button" class="button button-sm button-quiet" disabled={restoring === project.id} onclick={() => restore(project)}>Restore</button>
      </Row>
    {/each}
  </Group>
{/if}

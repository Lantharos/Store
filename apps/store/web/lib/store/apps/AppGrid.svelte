<script lang="ts">
  import type { CatalogEntry, SearchHit } from "@schelf/protocol"
  import AppRow from "./AppRow.svelte"

  let { apps, soon = true }: { apps: (CatalogEntry | SearchHit)[]; soon?: boolean } = $props()
</script>

<div class="overflow-hidden">
  <ul class="-mb-px grid grid-cols-1 gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
    {#each apps as app, index (app.id)}
      <li class="enter min-w-0 border-b border-hairline" style:--order={Math.min(index, 12)}>
        <AppRow {app} {soon} />
      </li>
    {/each}
  </ul>
</div>

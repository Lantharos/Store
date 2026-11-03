<script lang="ts">
  import type { CatalogEntry, SearchHit } from "@schelf/protocol"
  import AppRow from "./AppRow.svelte"

  let { apps }: { apps: (CatalogEntry | SearchHit)[] } = $props()
</script>

<div class="overflow-hidden">
  <ul class="-mb-px grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
    {#each apps as app, index (app.id)}
      <li class="enter border-b border-hairline" style:--order={Math.min(index, 12)}>
        <AppRow {app} />
      </li>
    {/each}
  </ul>
</div>

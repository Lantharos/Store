<script lang="ts">
  let { rows = 3 }: { rows?: number } = $props()
</script>

<div class="space-y-4" aria-busy="true" aria-label="Loading">
  {#each { length: rows } as _, index}
    <div class="placeholder h-16" style:opacity={1 - index * 0.22}></div>
  {/each}
</div>

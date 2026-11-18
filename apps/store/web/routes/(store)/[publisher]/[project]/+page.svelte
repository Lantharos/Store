<script lang="ts">
  import Page from "../../apps/[id]/+page.svelte"

  let { data } = $props()
</script>

<Page {data} />

<script lang="ts">
  import "../styles/app.css"
  import type { Snippet } from "svelte"
  import Toasts from "#lib/ui/overlay/Toasts.svelte"

  let { children }: { children: Snippet } = $props()
</script>

{@render children()}
<Toasts />

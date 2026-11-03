<script lang="ts">
  import LayoutGrid from "@lucide/svelte/icons/layout-grid"
  import { API_BASE } from "@schelf/protocol"
  import { onMount } from "svelte"
  import Avatar from "../../dashboard/account/Avatar.svelte"

  let user = $state<{ name: string; image: string | null } | null>(null)

  onMount(async () => {
    const response = await fetch(`${API_BASE}/dev/account`)
    if (response.ok) user = (await response.json()).user
  })
</script>

<a
  href="/dashboard"
  aria-label="Dashboard"
  title="Dashboard"
  class="hidden size-10 shrink-0 place-items-center rounded-full bg-well text-ink-soft transition-colors hover:bg-well/70 hover:text-ink md:grid"
>
  {#if user}
    <Avatar src={user.image} name={user.name} class="size-10 text-[15px]" />
  {:else}
    <LayoutGrid class="size-[18px]" />
  {/if}
</a>

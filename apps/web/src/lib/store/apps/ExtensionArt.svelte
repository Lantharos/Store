<script lang="ts">
  import AppIcon from "./AppIcon.svelte"
  import { thumbnail, thumbnailSet } from "./thumbnail.ts"

  let {
    art,
    icon,
    name,
    width,
    class: className = "",
    eager = false,
  }: {
    art: string | null
    icon: string | null
    name: string
    width: number
    class?: string
    eager?: boolean
  } = $props()
</script>

<span class="extension-art bg-well {className}">
  {#if art}
    <img
      src={thumbnail(art, width, width / 2)}
      srcset={thumbnailSet(art, width, width / 2)}
      alt=""
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      class="absolute inset-0 size-full object-cover"
    />
    <AppIcon src={icon} {name} {eager} class="absolute bottom-[11%] left-[5.5%] aspect-square h-[42%] w-auto shadow-[0_4px_14px_-4px_rgb(0_0_0/0.45)]" />
  {:else}
    <AppIcon src={icon} {name} {eager} class="absolute inset-0 m-auto aspect-square h-[54%] w-auto" />
  {/if}
</span>

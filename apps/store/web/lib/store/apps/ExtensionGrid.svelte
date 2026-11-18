<script lang="ts">
  import type { CatalogEntry } from "@schelf/protocol"
  import { appHref } from "../links.ts"
  import ExtensionArt from "./ExtensionArt.svelte"

  let { extensions }: { extensions: CatalogEntry[] } = $props()
</script>

<ul class="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
  {#each extensions as extension, index (extension.id)}
    <li class="enter min-w-0" style:--order={Math.min(index, 12)}>
      <a href={appHref(extension)} class="group block outline-offset-4">
        <ExtensionArt
          art={extension.art}
          icon={extension.icon}
          name={extension.name}
          width={480}
          eager={index < 3}
          class="w-full transition-transform duration-(--spring-smooth-duration) ease-(--spring-smooth) group-hover:scale-[1.015] group-active:scale-[0.99]"
        />
        <p class="mt-3 truncate font-semibold">{extension.name}</p>
        <p class="truncate text-[15px] text-ink-soft">{extension.summary}</p>
        <p class="truncate text-[13px] text-ink-muted">{extension.publisher.name}</p>
      </a>
    </li>
  {/each}
</ul>

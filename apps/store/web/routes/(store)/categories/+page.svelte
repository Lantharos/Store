<script lang="ts">
  import ArrowRight from "@lucide/svelte/icons/arrow-right"
  import { plural } from "#lib/format.ts"
  import Meta from "#lib/seo/Meta.svelte"
  import AppIcon from "#lib/store/apps/AppIcon.svelte"
  import { categoryLabel } from "#lib/store/categories.ts"

  let { data } = $props()
</script>

<Meta title="Categories · Schelf" description="Browse apps for Luft, Linux, Windows and macOS by what they're for." path="/categories" />

<div class="page">
  <h1 class="mt-6 text-[32px] font-semibold tracking-[-0.03em] sm:mt-10 sm:text-[40px]">Categories</h1>
  <ul class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {#each data.categories as category, index (category.slug)}
      <li class="enter" style:--order={index}>
        <a href="/categories/{category.slug}" class="group flex h-full flex-col rounded-tile bg-well p-6 transition-colors hover:bg-[color-mix(in_oklab,var(--well)_85%,var(--ink))]">
          <div class="flex items-baseline justify-between gap-3">
            <h2 class="text-xl font-semibold">{categoryLabel(category.name)}</h2>
            <ArrowRight class="size-4 -translate-x-1 text-ink-muted opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
          </div>
          <p class="mt-0.5 text-[15px] text-ink-muted">{plural(category.count, "app")}</p>
          <div class="mt-6 flex -space-x-2">
            {#each category.apps as app (app.id)}
              <AppIcon src={app.icon} name={app.name} class="size-11 ring-4 ring-well" />
            {/each}
          </div>
        </a>
      </li>
    {:else}
      <li class="text-ink-soft">Categories show up here as apps arrive.</li>
    {/each}
  </ul>
</div>

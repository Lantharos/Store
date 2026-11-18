<script lang="ts">
  import LoaderCircle from "@lucide/svelte/icons/loader-circle"
  import Search from "@lucide/svelte/icons/search"
  import type { SearchHit } from "@schelf/protocol"
  import AppIcon from "../store/apps/AppIcon.svelte"
  import { LiveSearch } from "../store/search/live.svelte.ts"
  import Dialog from "../ui/overlay/Dialog.svelte"

  let { open = $bindable(false), onpick }: { open?: boolean; onpick: (app: SearchHit) => void } = $props()

  const live = new LiveSearch(() => null)

  function pick(app: SearchHit) {
    onpick(app)
    open = false
    live.update("")
  }
</script>

<Dialog bind:open label="Pick an app" class="max-w-md">
  <div class="p-3">
    <label class="flex h-11 items-center gap-2.5 rounded-2xl bg-well px-4 text-[15px] transition-shadow focus-within:shadow-[0_0_0_2px_var(--accent)]">
      {#if live.loading}
        <LoaderCircle class="size-4 shrink-0 animate-spin text-ink-muted" />
      {:else}
        <Search class="size-4 shrink-0 text-ink-muted" strokeWidth={2.2} />
      {/if}
      <input
        type="search"
        value={live.query}
        placeholder="Find your app"
        autocomplete="off"
        spellcheck="false"
        aria-label="Find your app"
        class="min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-muted [&::-webkit-search-cancel-button]:hidden"
        oninput={(event) => live.update(event.currentTarget.value)}
      />
    </label>
    <ul class="mt-2 min-h-24">
      {#each live.results as hit (hit.id)}
        <li>
          <button type="button" onclick={() => pick(hit)} class="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-well focus-visible:bg-well">
            <AppIcon src={hit.icon} name={hit.name} class="size-9" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[15px] font-medium">{hit.name}</span>
              <span class="block truncate text-[13px] text-ink-muted">{hit.summary}</span>
            </span>
          </button>
        </li>
      {:else}
        <li class="px-3 py-8 text-center text-[15px] text-ink-muted">
          {live.query.trim() && !live.loading ? `Nothing called “${live.query.trim()}” yet.` : "Type your app’s name."}
        </li>
      {/each}
    </ul>
  </div>
</Dialog>

<script lang="ts">
  import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right"
  import type { Artifact } from "@schelf/protocol"
  import { bytes } from "../../format.ts"
  import { groupByPlatform, KIND_NAMES } from "../../system/artifacts.ts"

  let { artifacts, open, id }: { artifacts: Artifact[]; open: boolean; id: string } = $props()
  const groups = $derived(groupByPlatform(artifacts))
</script>

<div {id} class="disclosure grid {open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}" inert={!open}>
  <div class="min-h-0 overflow-hidden">
    <div class="mt-8 grid gap-x-8 gap-y-5 rounded-tile bg-well p-5 sm:grid-cols-2 sm:p-7 lg:grid-cols-3">
      {#each groups as group (group.platform)}
        <div>
          <p class="font-medium">{group.name}</p>
          <ul class="mt-1.5 space-y-0.5">
            {#each group.files as file (file.url)}
              <li>
                <a href={file.url} download class="group flex items-center justify-between gap-3 rounded-lg py-1 text-[15px] text-ink-soft hover:text-ink">
                  <span class="flex items-center gap-1.5">
                    {KIND_NAMES[file.kind]}
                    <ArrowUpRight class="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>
                  <span class="text-[13px] text-ink-muted tabular">{bytes(file.size)}</span>
                </a>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
      <p class="text-[13px] leading-relaxed text-ink-muted sm:col-span-full">
        Every file is signed by Schelf.
      </p>
    </div>
  </div>
</div>

<style>
  .disclosure {
    transition: grid-template-rows var(--spring-smooth-duration) var(--spring-smooth);
  }
</style>

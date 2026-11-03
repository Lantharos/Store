<script lang="ts">
  import { page } from "$app/state"
  import { session } from "../api/session.svelte.ts"
  import PublisherMark from "../publishers/PublisherMark.svelte"
  import { accountSections, publisherSections, type Section, settingsHref } from "./sections.ts"

  const publisher = $derived(session.publisher!)
  const groups = $derived([
    { label: publisher.name, mark: true, sections: publisherSections(publisher) },
    { label: "You", mark: false, sections: accountSections },
  ])
  const current = (section: Section) => page.url.pathname.startsWith(settingsHref(section.slug))
</script>

<nav aria-label="Settings" class="-mx-4 flex gap-6 overflow-x-auto px-4 scrollbar-none lg:mx-0 lg:flex-col lg:gap-7 lg:overflow-visible lg:px-0">
  {#each groups as group (group.label)}
    <div class="shrink-0">
      <p class="flex items-center gap-2 px-3 pb-2 text-[13px] text-ink-muted">
        {#if group.mark}<PublisherMark logo={publisher.logo} name={publisher.name} class="size-5 text-[11px]" />{/if}
        <span class="truncate">{group.label}</span>
      </p>
      <ul class="flex gap-1 lg:flex-col lg:gap-0.5">
        {#each group.sections as section (section.slug)}
          <li>
            <a
              href={settingsHref(section.slug)}
              aria-current={current(section) ? "page" : undefined}
              class="block rounded-xl px-3 py-1.5 text-[15px] whitespace-nowrap text-ink-soft transition-colors hover:text-ink aria-[current=page]:bg-well aria-[current=page]:text-ink"
            >
              {section.label}
            </a>
          </li>
        {/each}
      </ul>
    </div>
  {/each}
</nav>

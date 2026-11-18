<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left"
  import { page } from "$app/state"
  import Logo from "../../Logo.svelte"
  import { session } from "../api/session.svelte.ts"
  import PublisherMark from "../publishers/PublisherMark.svelte"
  import NavLink from "../shell/NavLink.svelte"
  import { accountSections, publisherSections, settingsHref } from "./sections.ts"

  const publisher = $derived(session.publisher!)
  const groups = $derived([
    { label: publisher.name, publisher: true, sections: publisherSections(publisher) },
    { label: "You", publisher: false, sections: accountSections },
  ])
</script>

<div class="flex h-full flex-col overflow-y-auto p-4 text-[15px]">
  <a href="/dashboard" class="mb-5 flex items-center gap-2.5 px-2 pt-1 text-lg font-semibold"><Logo class="size-7" />Schelf</a>

  <NavLink href="/dashboard" icon={ArrowLeft}>Back to apps</NavLink>

  <nav aria-label="Settings" class="mt-6 space-y-6">
    {#each groups as group (group.label)}
      <div>
        <p class="flex h-7 items-center gap-2.5 px-3 text-[13px] text-ink-muted">
          {#if group.publisher}<PublisherMark logo={session.logoOf(publisher)} name={publisher.name} person={publisher.kind === "person" && !publisher.logo} class="size-5 text-[11px]" />{/if}
          <span class="truncate">{group.label}</span>
        </p>
        <div class="mt-1 space-y-0.5">
          {#each group.sections as section (section.slug)}
            <NavLink href={settingsHref(section.slug)} icon={section.icon} current={page.url.pathname.startsWith(settingsHref(section.slug))}>{section.label}</NavLink>
          {/each}
        </div>
      </div>
    {/each}
  </nav>
</div>

<script lang="ts">
  import BadgeCheck from "@lucide/svelte/icons/badge-check"
  import ChevronsUpDown from "@lucide/svelte/icons/chevrons-up-down"
  import type { DashboardPublisher } from "@schelf/protocol"
  import { goto } from "$app/navigation"
  import { page } from "$app/state"
  import Menu, { type MenuItem } from "../../ui/overlay/Menu.svelte"
  import { session } from "../api/session.svelte.ts"
  import { sectionAfterSwitch } from "../settings/sections.ts"
  import PublisherMark from "./PublisherMark.svelte"

  let open = $state(false)
  let trigger = $state<HTMLButtonElement>()
  const current = $derived(session.publisher!)

  async function switchTo(publisher: DashboardPublisher) {
    await session.use(publisher.id)
    await goto(sectionAfterSwitch(page.url.pathname, publisher) ?? "/dashboard")
  }

  const items: MenuItem[] = $derived([
    ...(session.account?.publishers ?? []).map((publisher) => ({
      label: publisher.name,
      hint: publisher.kind === "person" ? "You" : undefined,
      selected: publisher.id === current.id,
      onselect: () => switchTo(publisher),
    })),
    { label: "New organisation", onselect: () => goto("/dashboard/organisations/new") },
  ])
</script>

<button
  bind:this={trigger}
  type="button"
  aria-haspopup="menu"
  aria-expanded={open}
  aria-label="Publishing as {current.name}"
  onclick={() => (open = !open)}
  class="mb-4 flex w-full items-center gap-3 rounded-xl px-1.5 py-1.5 text-left transition-colors hover:bg-well/60"
>
  <PublisherMark logo={session.logoOf(current)} name={current.name} person={current.kind === "person" && !current.logo} />
  <span class="min-w-0 flex-1">
    <span class="flex items-center gap-1.5 truncate font-medium text-ink">
      <span class="truncate">{current.name}</span>
      {#if current.verified}<BadgeCheck class="size-4 shrink-0 text-accent" aria-label="Verified" />{/if}
    </span>
    <span class="block truncate text-[13px] text-ink-muted">{current.kind === "person" ? "Just you" : "Organisation"}</span>
  </span>
  <ChevronsUpDown class="size-4 shrink-0 text-ink-muted" />
</button>
<Menu bind:open anchor={trigger} {items} class="w-64" />

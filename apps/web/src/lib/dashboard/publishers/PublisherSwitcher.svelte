<script lang="ts">
  import BadgeCheck from "@lucide/svelte/icons/badge-check"
  import ChevronsUpDown from "@lucide/svelte/icons/chevrons-up-down"
  import { goto } from "$app/navigation"
  import Menu, { type MenuItem } from "../../ui/overlay/Menu.svelte"
  import { session } from "../api/session.svelte.ts"
  import PublisherMark from "./PublisherMark.svelte"

  let open = $state(false)
  let trigger = $state<HTMLButtonElement>()
  const current = $derived(session.publisher!)

  const items: MenuItem[] = $derived([
    ...(session.account?.publishers ?? []).map((publisher) => ({
      label: publisher.name,
      hint: publisher.kind === "person" ? "You" : undefined,
      selected: publisher.id === current.id,
      onselect: () => session.use(publisher.id).then(() => goto("/dashboard")),
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
  class="mb-4 flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-well/60"
>
  <PublisherMark logo={current.logo} name={current.name} />
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

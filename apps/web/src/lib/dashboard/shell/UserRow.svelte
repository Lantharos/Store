<script lang="ts">
  import { goto } from "$app/navigation"
  import { scheme } from "../../theme/scheme.svelte.ts"
  import Menu, { type MenuItem } from "../../ui/overlay/Menu.svelte"
  import { session } from "../api/session.svelte.ts"

  let open = $state(false)
  let trigger = $state<HTMLButtonElement>()
  const name = $derived(session.account?.user.name ?? "")

  $effect(() => scheme.load())

  const items: MenuItem[] = $derived([
    { label: "Account", onselect: () => goto("/dashboard/account") },
    { label: "Light", selected: scheme.value === "light", onselect: () => scheme.set("light") },
    { label: "Dark", selected: scheme.value === "dark", onselect: () => scheme.set("dark") },
    { label: "Match the system", selected: scheme.value === "system", onselect: () => scheme.set("system") },
    { label: "Sign out", onselect: () => session.signOut().then(() => goto("/")) },
  ])
</script>

<button
  bind:this={trigger}
  type="button"
  aria-haspopup="menu"
  aria-expanded={open}
  onclick={() => (open = !open)}
  class="mt-3 flex w-full items-center gap-3 rounded-xl border-t border-hairline px-2 pt-4 pb-1.5 text-left"
>
  <span class="grid size-8 shrink-0 place-items-center rounded-full bg-accent font-semibold text-accent-ink">{name.slice(0, 1)}</span>
  <span class="min-w-0 flex-1">
    <span class="block truncate text-ink">{name}</span>
    <span class="block truncate text-[13px] text-ink-muted">{session.account?.user.email}</span>
  </span>
</button>
<Menu bind:open anchor={trigger} {items} placement="top-start" />

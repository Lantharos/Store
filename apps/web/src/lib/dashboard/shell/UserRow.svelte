<script lang="ts">
  import { page } from "$app/state"
  import { session } from "../api/session.svelte.ts"
  import { settingsHref } from "../settings/sections.ts"

  const name = $derived(session.account?.user.name ?? "")
  const href = settingsHref("account")
</script>

<a
  {href}
  aria-current={page.url.pathname === href ? "page" : undefined}
  class="mt-3 flex w-full items-center gap-3 rounded-xl border-t border-hairline px-2 pt-4 pb-1.5 text-left"
>
  <span class="grid size-8 shrink-0 place-items-center rounded-full bg-accent font-semibold text-accent-ink">{name.slice(0, 1)}</span>
  <span class="min-w-0 flex-1">
    <span class="block truncate text-ink">{name}</span>
    <span class="block truncate text-[13px] text-ink-muted">{session.account?.user.email}</span>
  </span>
</a>

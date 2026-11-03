<script lang="ts">
  import { page } from "$app/state"
  import Avatar from "../account/Avatar.svelte"
  import { session } from "../api/session.svelte.ts"
  import { settingsHref } from "../settings/sections.ts"

  const user = $derived(session.account!.user)
  const href = settingsHref("account")
</script>

<div class="mt-3 border-t border-hairline pt-3">
  <a
    {href}
    aria-current={page.url.pathname === href ? "page" : undefined}
    class="flex items-center gap-3 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-well/60 aria-[current=page]:bg-well"
  >
    <Avatar src={user.image} name={user.name} class="size-8 text-[13px]" />
    <span class="min-w-0 flex-1">
      <span class="block truncate text-ink">{user.name}</span>
      <span class="block truncate text-[13px] text-ink-muted">{user.email}</span>
    </span>
  </a>
</div>

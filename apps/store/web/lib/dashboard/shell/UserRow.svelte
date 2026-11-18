<script lang="ts">
  import Settings from "@lucide/svelte/icons/settings"
  import Avatar from "../account/Avatar.svelte"
  import { session } from "../api/session.svelte.ts"
  import { settingsHref } from "../settings/sections.ts"

  const user = $derived(session.account!.user)
  const href = settingsHref("account")
</script>

<div class="mt-3 border-t border-hairline pt-3">
  <a
    {href}
    aria-label="Settings for {user.name}"
    class="group flex items-center gap-3 rounded-xl py-1.5 pr-2.5 pl-1.5 transition-colors hover:bg-well/60"
  >
    <Avatar src={user.image} name={user.name} class="size-8 text-[13px]" />
    <span class="min-w-0 flex-1">
      <span class="block truncate text-ink">{user.name}</span>
      <span class="block truncate text-[13px] text-ink-muted">{user.email}</span>
    </span>
    <Settings class="size-[18px] shrink-0 text-ink-muted transition-colors group-hover:text-ink" />
  </a>
</div>

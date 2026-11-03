<script lang="ts">
  import File from "@lucide/svelte/icons/file"
  import Folder from "@lucide/svelte/icons/folder"
  import Globe from "@lucide/svelte/icons/globe"
  import GlobeLock from "@lucide/svelte/icons/globe-lock"
  import MessagesSquare from "@lucide/svelte/icons/messages-square"
  import ShieldAlert from "@lucide/svelte/icons/shield-alert"
  import Usb from "@lucide/svelte/icons/usb"
  import type { Permissions } from "@schelf/protocol"
  import { describePermissions, type PermissionIcon } from "./permissions.ts"

  let { permissions, extension = false }: { permissions: Permissions | null; extension?: boolean } = $props()

  const ICONS = {
    full: ShieldAlert,
    folder: Folder,
    device: Usb,
    talk: MessagesSquare,
    network: Globe,
    offline: GlobeLock,
  } satisfies Record<PermissionIcon, unknown>
  const described = $derived(describePermissions(permissions))
</script>

<section aria-labelledby="permissions">
  <h2 id="permissions" class="font-semibold">What it can use</h2>
  <ul class="mt-3 space-y-2.5 text-[15px] text-ink-soft">
    {#each described.lines as line (line.text)}
      {@const Icon = line.text === "Files you open with it" ? File : ICONS[line.icon]}
      <li class="flex gap-3">
        <Icon class="mt-0.5 size-[18px] shrink-0 {line.icon === 'full' ? 'text-caution' : 'text-ink-muted'}" />
        <span>
          <span class={line.icon === "full" ? "font-medium text-ink" : ""}>{line.text}</span>
          {#if line.detail}<span class="mt-0.5 block text-[13px] leading-relaxed text-ink-muted">{line.detail}</span>{/if}
        </span>
      </li>
    {/each}
  </ul>
  {#if described.full && !extension}
    <p class="mt-3 text-[13px] leading-relaxed text-ink-muted">A person at Schelf reads every release before it's here, and can stop it on every computer if it ever misbehaves.</p>
  {/if}
</section>

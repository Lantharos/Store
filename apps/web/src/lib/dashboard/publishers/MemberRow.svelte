<script lang="ts">
  import Ellipsis from "@lucide/svelte/icons/ellipsis"
  import { type Member, ROLE_NAMES, type Role } from "@schelf/protocol"
  import { date } from "../../format.ts"
  import Select from "../../ui/fields/Select.svelte"
  import Menu, { type MenuItem } from "../../ui/overlay/Menu.svelte"
  import { session } from "../api/session.svelte.ts"
  import { roleOptions } from "./roles.ts"

  let {
    member,
    onrole,
    onremove,
    ontransfer,
  }: {
    member: Member
    onrole: (role: Role) => void
    onremove: () => void
    ontransfer: () => void
  } = $props()

  let open = $state(false)
  let trigger = $state<HTMLButtonElement>()
  let role = $state<Role>("developer")
  const you = $derived(member.user_id === session.account?.user.id)
  const owners = $derived(session.can("owners"))
  const manageable = $derived(!you && session.can("members") && (member.role !== "owner" || owners))

  $effect.pre(() => {
    role = member.role
  })

  const items: MenuItem[] = $derived([
    ...(owners && !you ? [{ label: "Make owner and step down", onselect: ontransfer }] : []),
    { label: you ? "Leave" : "Remove", danger: true, onselect: onremove },
  ])
</script>

<li class="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
  <span class="grid size-9 shrink-0 place-items-center rounded-full bg-well font-semibold text-ink-soft">{member.name.slice(0, 1)}</span>
  <div class="min-w-0 flex-1">
    <p class="truncate font-medium">{member.name}{#if you}<span class="font-normal text-ink-muted">{" (you)"}</span>{/if}</p>
    <p class="truncate text-[13px] text-ink-muted">{member.email} · joined {date(member.joined_at)}</p>
  </div>
  {#if manageable}
    <div class="w-36"><Select bind:value={role} label="Role of {member.name}" options={roleOptions(owners)} onchange={onrole} /></div>
  {:else}
    <span class="w-36 text-[15px] text-ink-soft">{ROLE_NAMES[member.role].label}</span>
  {/if}
  {#if manageable || you}
    <button bind:this={trigger} type="button" class="button size-9 p-0 hover:bg-well" aria-label="More for {member.name}" aria-haspopup="menu" aria-expanded={open} onclick={() => (open = !open)}>
      <Ellipsis class="size-4" />
    </button>
    <Menu bind:open anchor={trigger} {items} placement="bottom-end" />
  {:else}
    <span class="size-9"></span>
  {/if}
</li>

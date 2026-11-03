<script lang="ts">
  import AtSign from "@lucide/svelte/icons/at-sign"
  import Mail from "@lucide/svelte/icons/mail"
  import { type Member, type Members, ROLE_NAMES, type Role } from "@schelf/protocol"
  import { api } from "#lib/dashboard/api/client.ts"
  import { endpoints } from "#lib/dashboard/api/endpoints.ts"
  import { resource } from "#lib/dashboard/api/resource.svelte.ts"
  import { session } from "#lib/dashboard/api/session.svelte.ts"
  import InviteForm from "#lib/dashboard/publishers/InviteForm.svelte"
  import MemberRow from "#lib/dashboard/publishers/MemberRow.svelte"
  import { settingsHref } from "#lib/dashboard/settings/sections.ts"
  import Failed from "#lib/dashboard/shell/Failed.svelte"
  import Loading from "#lib/dashboard/shell/Loading.svelte"
  import PageHeader from "#lib/dashboard/shell/PageHeader.svelte"
  import { ago } from "#lib/format.ts"
  import Confirm from "#lib/ui/overlay/Confirm.svelte"
  import { toasts } from "#lib/ui/overlay/toasts.svelte.ts"
  import { goto } from "$app/navigation"

  const publisher = $derived(session.publisher!)
  const members = $derived(resource<Members>(endpoints.members(publisher.id)))
  let removing = $state<Member | null>(null)
  let transferring = $state<Member | null>(null)
  let removeOpen = $state(false)
  let transferOpen = $state(false)
  const leaving = $derived(removing?.user_id === session.account?.user.id)

  $effect(() => {
    if (publisher.kind === "person") void goto(settingsHref("profile"))
  })

  async function changeRole(member: Member, role: Role) {
    try {
      await api.patch(endpoints.member(publisher.id, member.user_id), { role })
      toasts.show(
        `${member.name} is now ${role === "admin" || role === "owner" ? "an" : "a"} ${ROLE_NAMES[role].label.toLowerCase()}`,
      )
    } catch (error) {
      toasts.error(error)
    }
    await members.refresh()
  }

  async function remove() {
    const member = removing!
    await api.delete(endpoints.member(publisher.id, member.user_id))
    if (leaving) {
      await session.refreshAccount()
      await session.refreshApps()
      toasts.show(`You left ${publisher.name}`)
      await goto("/dashboard")
      return
    }
    await members.refresh()
    toasts.show(`${member.name} was removed`)
  }

  async function transfer() {
    const member = transferring!
    await api.post(endpoints.transfer(publisher.id, member.user_id))
    await Promise.all([session.refreshAccount(), members.refresh()])
    toasts.show(`${member.name} owns ${publisher.name} now`)
  }

  async function revoke(id: string) {
    try {
      await api.delete(endpoints.invite(publisher.id, id))
      await members.refresh()
    } catch (error) {
      toasts.error(error)
    }
  }
</script>

<PageHeader title="Members" text="Everyone who works on {publisher.name}'s apps. Owners decide who's in and can ask for verification, admins manage apps and people, developers ship releases and listings." />

{#if session.can("members")}
  <section class="mt-8 max-w-2xl">
    <InviteForm oninvited={() => members.refresh()} />
  </section>
{/if}

<div class="mt-10 max-w-3xl">
  {#if members.error}
    <Failed error={members.error} retry={() => members.refresh()} />
  {:else if !members.data}
    <Loading />
  {:else}
    <ul class="divide-y divide-hairline">
      {#each members.data.members as member (member.user_id)}
        <MemberRow
          {member}
          onrole={(role) => changeRole(member, role)}
          onremove={() => ((removing = member), (removeOpen = true))}
          ontransfer={() => ((transferring = member), (transferOpen = true))}
        />
      {/each}
    </ul>

    {#if members.data.invites.length}
      <h2 class="mt-12 text-xl font-semibold">Invited</h2>
      <ul class="mt-2 divide-y divide-hairline">
        {#each members.data.invites as invite (invite.id)}
          <li class="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
            <span class="grid size-9 shrink-0 place-items-center rounded-full bg-well text-ink-muted">
              {#if invite.email}<Mail class="size-4" />{:else}<AtSign class="size-4" />{/if}
            </span>
            <div class="min-w-48 flex-1">
              <p class="truncate font-medium">{invite.email ?? invite.github}</p>
              <p class="truncate text-[13px] text-ink-muted">{ROLE_NAMES[invite.role].label}{invite.invited_by ? `, invited by ${invite.invited_by}` : ""} · expires {ago(invite.expires_at)}</p>
            </div>
            {#if session.can("members")}<button type="button" class="button button-sm button-quiet" onclick={() => revoke(invite.id)}>Cancel invitation</button>{/if}
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</div>

<Confirm bind:open={removeOpen} title={leaving ? `Leave ${publisher.name}?` : `Remove ${removing?.name}?`} confirm={leaving ? "Leave" : "Remove"} danger onconfirm={remove}>
  <p>{leaving ? "You won't see its apps any more. An owner can invite you again." : `${removing?.name} won't be able to see or change ${publisher.name}'s apps. Releases they made stay as they are.`}</p>
</Confirm>

<Confirm bind:open={transferOpen} title="Make {transferring?.name} the owner?" confirm="Transfer ownership" onconfirm={transfer}>
  <p>{transferring?.name} becomes an owner and you become an admin. Only an owner can make you an owner again.</p>
</Confirm>

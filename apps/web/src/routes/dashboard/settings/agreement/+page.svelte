<script lang="ts">
  import { can, type DashboardPublisher } from "@schelf/protocol"
  import { api } from "#lib/dashboard/api/client.ts"
  import { endpoints } from "#lib/dashboard/api/endpoints.ts"
  import { session } from "#lib/dashboard/api/session.svelte.ts"
  import PublisherMark from "#lib/dashboard/publishers/PublisherMark.svelte"
  import PageHeader from "#lib/dashboard/shell/PageHeader.svelte"
  import Group from "#lib/ui/group/Group.svelte"
  import Row from "#lib/ui/group/Row.svelte"
  import { toasts } from "#lib/ui/overlay/toasts.svelte.ts"

  const current = $derived(session.account!.agreement)
  const publishers = $derived(session.account!.publishers)

  async function accept(publisher: DashboardPublisher) {
    try {
      session.updatePublisher(
        await api.patch<DashboardPublisher>(endpoints.publisher(publisher.id), { agreement: current }),
      )
      toasts.show(`${publisher.name} is on the current agreement`)
    } catch (error) {
      toasts.error(error)
    }
  }
</script>

<PageHeader title="Developer agreement" text="Each publisher you belong to accepts the agreement once, and again when it changes in substance. Owners accept it on an organisation's behalf." />

<Group class="mt-8" rows>
  {#each publishers as publisher (publisher.id)}
    {@const upToDate = publisher.agreement_version === current}
    <Row title={publisher.name} description={upToDate ? `Accepted version ${publisher.agreement_version}` : `Accepted version ${publisher.agreement_version}, before the current one`}>
      {#snippet leading()}<PublisherMark logo={session.logoOf(publisher)} name={publisher.name} person={publisher.kind === "person" && !publisher.logo} />{/snippet}
      {#if !upToDate}
        {#if can(publisher.role, "owners")}
          <button type="button" class="button button-sm button-primary" onclick={() => accept(publisher)}>Accept {current}</button>
        {:else}
          <span class="text-[13px] text-ink-muted">An owner accepts it</span>
        {/if}
      {/if}
    </Row>
  {/each}
</Group>

<p class="mt-3 px-1 text-[13px] text-ink-muted">The current version is <a href="/legal/developer-agreement" target="_blank" class="link">{current}</a>.</p>

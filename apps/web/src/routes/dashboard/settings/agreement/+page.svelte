<script lang="ts">
  import { can, type DashboardPublisher } from "@schelf/protocol"
  import { api } from "#lib/dashboard/api/client.ts"
  import { endpoints } from "#lib/dashboard/api/endpoints.ts"
  import { session } from "#lib/dashboard/api/session.svelte.ts"
  import PublisherMark from "#lib/dashboard/publishers/PublisherMark.svelte"
  import PageHeader from "#lib/dashboard/shell/PageHeader.svelte"
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

<p class="mt-8 max-w-2xl text-[15px] leading-relaxed text-ink-soft">The current version is <a href="/legal/developer-agreement" target="_blank" class="link">{current}</a>.</p>

<ul class="mt-4 max-w-2xl divide-y divide-hairline">
  {#each publishers as publisher (publisher.id)}
    {@const upToDate = publisher.agreement_version === current}
    <li class="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
      <PublisherMark logo={publisher.logo} name={publisher.name} />
      <div class="min-w-0 flex-1">
        <p class="truncate font-medium">{publisher.name}</p>
        <p class="text-[13px] text-ink-muted">{upToDate ? `Accepted version ${publisher.agreement_version}` : `Accepted version ${publisher.agreement_version}, before the current one`}</p>
      </div>
      {#if !upToDate}
        {#if can(publisher.role, "owners")}
          <button type="button" class="button button-sm button-primary" onclick={() => accept(publisher)}>Accept {current}</button>
        {:else}
          <span class="text-[13px] text-ink-muted">An owner accepts it</span>
        {/if}
      {/if}
    </li>
  {/each}
</ul>

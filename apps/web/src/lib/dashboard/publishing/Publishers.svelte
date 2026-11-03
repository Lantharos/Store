<script lang="ts">
  import GitBranch from "@lucide/svelte/icons/git-branch"
  import { SCHELF_WORKFLOW, type TrustedPublisher } from "@schelf/protocol"
  import { date } from "../../format.ts"
  import Field from "../../ui/fields/Field.svelte"
  import Confirm from "../../ui/overlay/Confirm.svelte"
  import Dialog from "../../ui/overlay/Dialog.svelte"
  import { toasts } from "../../ui/overlay/toasts.svelte.ts"
  import { api } from "../api/client.ts"
  import { endpoints } from "../api/endpoints.ts"
  import { session } from "../api/session.svelte.ts"

  let { appId, publishers = $bindable() }: { appId: string; publishers: TrustedPublisher[] } = $props()

  let adding = $state(false)
  let removing = $state<TrustedPublisher | null>(null)
  let removeOpen = $state(false)
  let form = $state({ repository: "", workflow: SCHELF_WORKFLOW, environment: "" })
  let error = $state<string | null>(null)
  let busy = $state(false)

  async function add(event: SubmitEvent) {
    event.preventDefault()
    busy = true
    error = null
    try {
      const created = await api.post<TrustedPublisher>(endpoints.trustedPublishers(appId), {
        repository: form.repository.trim().replace(/^https:\/\/github\.com\//, ""),
        workflow: form.workflow.trim(),
        environment: form.environment.trim() || undefined,
      })
      publishers = [...publishers, created]
      adding = false
      toasts.show("Trusted publisher added")
    } catch (failure) {
      error = (failure as Error).message
    } finally {
      busy = false
    }
  }

  async function remove() {
    const publisher = removing!
    await api.delete(endpoints.trustedPublisher(appId, publisher.id))
    publishers = publishers.filter((item) => item.id !== publisher.id)
    toasts.show("Trusted publisher removed")
  }
</script>

<section>
  <div class="flex flex-wrap items-end justify-between gap-4">
    <div>
      <h2 class="text-xl font-semibold">Trusted publishers</h2>
      <p class="mt-1 max-w-xl text-[15px] leading-relaxed text-ink-muted">Workflows allowed to publish releases of this app. Nothing else can. <a href="/docs/trusted-publishing" class="link">How it works</a></p>
    </div>
    {#if session.can("apps")}<button type="button" class="button button-sm button-quiet" onclick={() => ((form = { repository: "", workflow: SCHELF_WORKFLOW, environment: "" }), (error = null), (adding = true))}>Add a publisher</button>{/if}
  </div>
  <ul class="mt-4 divide-y divide-hairline">
    {#each publishers as publisher (publisher.id)}
      <li class="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
        <GitBranch class="size-5 shrink-0 text-ink-muted" />
        <div class="min-w-0 flex-1">
          <a href="https://github.com/{publisher.repository}" target="_blank" rel="noreferrer" class="font-medium hover:underline">{publisher.repository}</a>
          <p class="truncate font-mono text-[13px] text-ink-muted">{publisher.workflow}{publisher.environment ? ` · environment ${publisher.environment}` : ""}</p>
        </div>
        <span class="text-[13px] text-ink-muted">Added {date(publisher.created_at)}</span>
        {#if session.can("apps")}<button type="button" class="button button-sm button-danger" onclick={() => ((removing = publisher), (removeOpen = true))}>Remove</button>{/if}
      </li>
    {:else}
      <li class="py-6 text-[15px] text-ink-muted">No workflow can publish this app yet. Add one, or run <span class="font-mono text-[13px]">bunx schelf init</span> in the repository.</li>
    {/each}
  </ul>
</section>

<Dialog bind:open={adding}>
  <form class="space-y-5 p-6 sm:p-7" onsubmit={add}>
    <h2 class="text-xl font-semibold">Add a trusted publisher</h2>
    <Field label="Repository" hint="owner/name on GitHub">
      <input class="field" bind:value={form.repository} placeholder="alice/notes" required autocomplete="off" />
    </Field>
    <Field label="Workflow">
      <input class="field font-mono text-[14px]" bind:value={form.workflow} required />
    </Field>
    <Field label="Environment" hint="Optional. Only jobs in this GitHub environment can publish.">
      <input class="field" bind:value={form.environment} placeholder="release" />
    </Field>
    {#if error}<p class="text-[15px] text-danger" role="alert">{error}</p>{/if}
    <div class="flex justify-end gap-2 pt-2">
      <button type="button" class="button button-quiet" onclick={() => (adding = false)}>Cancel</button>
      <button class="button button-primary" disabled={busy}>Add</button>
    </div>
  </form>
</Dialog>

<Confirm bind:open={removeOpen} title="Remove this publisher?" confirm="Remove" danger onconfirm={remove}>
  <p>Releases from <span class="font-mono text-[13px]">{removing?.repository}</span> stop being accepted right away. Releases already published aren't affected.</p>
</Confirm>

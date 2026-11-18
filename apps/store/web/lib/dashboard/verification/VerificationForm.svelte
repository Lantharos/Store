<script lang="ts">
  import CircleCheck from "@lucide/svelte/icons/circle-check"
  import { type SaveVerification, saveVerification, type Verification } from "@schelf/protocol"
  import { untrack } from "svelte"
  import Field from "../../ui/fields/Field.svelte"
  import Group from "../../ui/group/Group.svelte"
  import { toasts } from "../../ui/overlay/toasts.svelte.ts"
  import { session } from "../api/session.svelte.ts"
  import ContactField from "./ContactField.svelte"
  import Documents from "./Documents.svelte"
  import DomainList from "./DomainList.svelte"
  import type { VerificationFlow } from "./verification.svelte.ts"

  let {
    flow,
    verification,
    editable,
  }: { flow: VerificationFlow; verification: Verification; editable: boolean } = $props()

  let text = $state(
    untrack(() => ({
      legal_name: verification.legal_name,
      website: verification.website ?? "",
      github_org: verification.github_org ?? "",
      note: verification.note,
    })),
  )

  async function keep(changes: SaveVerification) {
    const parsed = saveVerification.safeParse(changes)
    if (!parsed.success) {
      toasts.show(parsed.error.issues[0]!.message, "danger")
      return
    }
    await flow.save(parsed.data)
  }
</script>

<div class="space-y-10">
  <Group title="About you">
    <Field label="Legal or trading name" hint="The name you trade under, as it appears in a company register or on invoices.">
      <input bind:value={text.legal_name} class="field" maxlength="200" disabled={!editable} onchange={() => keep({ legal_name: text.legal_name })} />
    </Field>
    <Field label="Website">
      <input bind:value={text.website} class="field" type="url" placeholder="https://example.com" disabled={!editable} onchange={() => keep({ website: text.website.trim() || null })} />
    </Field>
    <Field label="Who you are" count={{ used: text.note.length, max: 2000 }} hint="A few sentences on who's behind the apps, and anything that helps us check it.">
      <textarea bind:value={text.note} class="field h-36 resize-y py-3 leading-relaxed" maxlength="2000" disabled={!editable} onchange={() => keep({ note: text.note })}></textarea>
    </Field>
  </Group>

  <Group title="Domains" description="The domains you publish under. Domains of namespaces you've already proven count right away.">
    <DomainList {flow} {verification} {editable} />
  </Group>

  <Group title="Contact email" description="An address on one of your domains. We send it a code to confirm it reaches you.">
    <ContactField {flow} {verification} {editable} />
  </Group>

  <Group title="GitHub organisation" description="Optional. Proven when you're one of its owners on GitHub, through the GitHub account connected to yours.">
    {#if verification.github_org_proven}
      <p class="flex items-center gap-3"><CircleCheck class="size-[18px] text-accent" />github.com/{verification.github_org}</p>
    {:else}
      <div class="flex flex-col gap-2 sm:flex-row">
        <input bind:value={text.github_org} class="field" placeholder="your-organisation" aria-label="GitHub organisation" spellcheck="false" disabled={!editable} onchange={() => keep({ github_org: text.github_org.trim() || null })} />
        {#if editable && verification.github_org}
          {#if session.account?.github}
            <button type="button" class="button button-quiet shrink-0" disabled={flow.busy !== null} onclick={() => flow.proveGithub()}>Prove it</button>
          {:else}
            <a href="/dashboard/settings/account" class="button button-quiet shrink-0">Connect GitHub</a>
          {/if}
        {/if}
      </div>
    {/if}
  </Group>

  <Group title="Documents" description="Optional. A company register extract or a trademark, as PDF, PNG or JPEG. Only the people reviewing your request see them.">
    <Documents {flow} {verification} {editable} />
  </Group>
</div>

<script lang="ts">
  import CircleCheck from "@lucide/svelte/icons/circle-check"
  import CircleDashed from "@lucide/svelte/icons/circle-dashed"
  import type { Verification } from "@schelf/protocol"
  import { bytes } from "../../format.ts"
  import Group from "../../ui/group/Group.svelte"
  import Row from "../../ui/group/Row.svelte"

  let { verification }: { verification: Verification } = $props()

  const PROOFS = {
    namespace: "through your namespace",
    dns: "by its DNS record",
    "well-known": "by the file on the site",
  }
</script>

{#snippet proven(yes: boolean, text: string)}
  <li class="flex items-center gap-2.5 text-[15px] text-ink-soft">
    {#if yes}<CircleCheck class="size-4 shrink-0 text-accent" />{:else}<CircleDashed class="size-4 shrink-0 text-ink-muted" />{/if}
    <span class="min-w-0 break-words">{text}</span>
  </li>
{/snippet}

<Group title="What you sent" rows>
  <Row title="Legal or trading name">
    {#snippet below()}<p class="text-[15px] text-ink-soft">{verification.legal_name}</p>{/snippet}
  </Row>
  <Row title="Website">
    {#snippet below()}<p class="text-[15px] break-all text-ink-soft">{verification.website ?? "None"}</p>{/snippet}
  </Row>
  <Row title="Domains">
    {#snippet below()}
      <ul class="space-y-1.5">
        {#each verification.domains as domain (domain.name)}
          {@render proven(domain.proof !== null, domain.proof ? `${domain.name}, proven ${PROOFS[domain.proof]}` : `${domain.name}, not proven yet`)}
        {/each}
      </ul>
    {/snippet}
  </Row>
  <Row title="Contact email">
    {#snippet below()}
      <ul>{@render proven(verification.contact_confirmed, verification.contact_email ?? "None")}</ul>
    {/snippet}
  </Row>
  {#if verification.github_org}
    <Row title="GitHub organisation">
      {#snippet below()}
        <ul>{@render proven(verification.github_org_proven, verification.github_org_proven ? `github.com/${verification.github_org}, you're an owner` : `github.com/${verification.github_org}, not proven`)}</ul>
      {/snippet}
    </Row>
  {/if}
  {#if verification.note}
    <Row title="Who you are">
      {#snippet below()}<p class="text-[15px] leading-relaxed whitespace-pre-line text-ink-soft">{verification.note}</p>{/snippet}
    </Row>
  {/if}
  {#if verification.documents.length}
    <Row title="Documents">
      {#snippet below()}
        <ul class="space-y-1 text-[15px] text-ink-soft">
          {#each verification.documents as document (document.id)}
            <li class="flex justify-between gap-4"><span class="truncate">{document.name}</span><span class="shrink-0 text-ink-muted tabular">{bytes(document.size)}</span></li>
          {/each}
        </ul>
      {/snippet}
    </Row>
  {/if}
</Group>

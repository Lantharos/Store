<script lang="ts">
  import FileText from "@lucide/svelte/icons/file-text"
  import LoaderCircle from "@lucide/svelte/icons/loader-circle"
  import X from "@lucide/svelte/icons/x"
  import { MAX_DOCUMENT_BYTES, MAX_DOCUMENTS, type Verification } from "@schelf/protocol"
  import { bytes } from "../../format.ts"
  import { toasts } from "../../ui/overlay/toasts.svelte.ts"
  import type { VerificationFlow } from "./verification.svelte.ts"

  let {
    flow,
    verification,
    editable,
  }: { flow: VerificationFlow; verification: Verification; editable: boolean } = $props()
  let picker = $state<HTMLInputElement>()

  async function attach(files: FileList | null) {
    for (const file of files ?? []) {
      if (file.size > MAX_DOCUMENT_BYTES) toasts.show(`${file.name} is over 10 MB`, "danger")
      else await flow.attach(file)
    }
    if (picker) picker.value = ""
  }
</script>

<div>
  {#if verification.documents.length}
    <ul class="mb-3 divide-y divide-hairline">
      {#each verification.documents as document (document.id)}
        <li class="flex items-center gap-3 py-2.5">
          <FileText class="size-[18px] shrink-0 text-ink-muted" />
          <span class="min-w-0 flex-1 truncate">{document.name}</span>
          <span class="text-[13px] text-ink-muted tabular">{bytes(document.size)}</span>
          {#if editable}
            <button type="button" class="button size-8 p-0 text-ink-muted hover:bg-well hover:text-ink" aria-label="Remove {document.name}" onclick={() => flow.detach(document.id)}><X class="size-4" /></button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
  {#if editable && verification.documents.length < MAX_DOCUMENTS}
    <button type="button" class="button button-sm button-quiet" disabled={flow.busy !== null} onclick={() => picker?.click()}>
      {#if flow.busy === "attach"}<LoaderCircle class="size-3.5 animate-spin" />Attaching{:else}Attach a document{/if}
    </button>
    <input bind:this={picker} type="file" accept="application/pdf,image/png,image/jpeg" multiple hidden onchange={(event) => attach(event.currentTarget.files)} />
  {/if}
</div>

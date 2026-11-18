<script lang="ts">
  import type { Snippet } from "svelte"
  import type { HTMLButtonAttributes } from "svelte/elements"

  let {
    accept,
    multiple = false,
    onpick,
    children,
    ...button
  }: Omit<HTMLButtonAttributes, "onclick" | "type"> & {
    accept?: string
    multiple?: boolean
    onpick: (files: File[]) => void
    children: Snippet
  } = $props()

  let input = $state<HTMLInputElement>()

  function change() {
    const files = [...input!.files!]
    input!.value = ""
    if (files.length) onpick(files)
  }
</script>

<button type="button" {...button} onclick={() => input!.click()}>{@render children()}</button>
<input bind:this={input} type="file" {accept} {multiple} hidden onchange={change} />

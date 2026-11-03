<script lang="ts">
  import { focusOnMount } from "../../ui/focus.ts"
  import { CODE_LENGTH } from "../api/auth.ts"

  let { value = $bindable(""), oncomplete }: { value?: string; oncomplete: (code: string) => void } = $props()

  function input(event: Event & { currentTarget: HTMLInputElement }) {
    value = event.currentTarget.value.replace(/\D/g, "").slice(0, CODE_LENGTH)
    event.currentTarget.value = value
    if (value.length === CODE_LENGTH) oncomplete(value)
  }
</script>

<div class="relative">
  <input
    {value}
    oninput={input}
    inputmode="numeric"
    autocomplete="one-time-code"
    maxlength={CODE_LENGTH}
    aria-label="Code"
    {@attach focusOnMount}
    class="peer absolute inset-0 z-10 w-full cursor-text opacity-0"
  />
  <div aria-hidden="true" class="grid grid-cols-6 gap-2">
    {#each { length: CODE_LENGTH } as _, index}
      {@const filled = value[index]}
      {@const caret = index === Math.min(value.length, CODE_LENGTH - 1)}
      <span
        class="grid h-14 place-items-center rounded-2xl bg-well font-mono text-2xl tabular transition-shadow {caret
          ? 'peer-focus:shadow-[0_0_0_2px_var(--accent)]'
          : ''}"
      >
        {filled ?? ""}
      </span>
    {/each}
  </div>
</div>

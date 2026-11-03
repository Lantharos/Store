<script lang="ts" generics="T extends string">
  import Check from "@lucide/svelte/icons/check"
  import ChevronDown from "@lucide/svelte/icons/chevron-down"
  import Popover from "../overlay/Popover.svelte"

  interface Option {
    value: T
    label: string
  }

  let {
    value = $bindable(),
    options,
    placeholder = "Choose",
    label,
    onchange,
  }: { value?: T; options: Option[]; placeholder?: string; label: string; onchange?: (value: T) => void } = $props()

  const id = $props.id()
  let open = $state(false)
  let trigger = $state<HTMLButtonElement>()
  let active = $state(0)
  const current = $derived(options.find((option) => option.value === value))

  function show() {
    active = Math.max(0, options.findIndex((option) => option.value === value))
    open = true
  }

  function choose(option: Option) {
    value = option.value
    open = false
    onchange?.(option.value)
    trigger?.focus()
  }

  function keydown(event: KeyboardEvent) {
    if (!open && ["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault()
      show()
      return
    }
    if (!open) return
    if (event.key === "ArrowDown") active = (active + 1) % options.length
    else if (event.key === "ArrowUp") active = (active - 1 + options.length) % options.length
    else if (event.key === "Enter" || event.key === " ") choose(options[active]!)
    else if (event.key === "Tab") open = false
    else return
    event.preventDefault()
  }
</script>

<button
  bind:this={trigger}
  type="button"
  role="combobox"
  aria-label={label}
  aria-haspopup="listbox"
  aria-expanded={open}
  aria-controls="{id}-list"
  aria-activedescendant={open ? `${id}-${active}` : undefined}
  onclick={() => (open ? (open = false) : show())}
  onkeydown={keydown}
  class="field flex items-center justify-between gap-2 text-left"
>
  <span class="truncate {current ? '' : 'text-ink-muted'}">{current?.label ?? placeholder}</span>
  <ChevronDown class="size-4 shrink-0 text-ink-muted transition-transform {open ? 'rotate-180' : ''}" />
</button>

<Popover bind:open anchor={trigger} class="max-h-72 overflow-y-auto p-1.5">
  <div id="{id}-list" role="listbox" aria-label={label} style:min-width="{trigger?.offsetWidth ?? 160}px">
    {#each options as option, index (option.value)}
      <button
        id="{id}-{index}"
        type="button"
        role="option"
        tabindex="-1"
        aria-selected={option.value === value}
        onpointermove={() => (active = index)}
        onclick={() => choose(option)}
        class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[15px] {index === active ? 'bg-well' : ''}"
      >
        <span class="flex-1">{option.label}</span>
        {#if option.value === value}<Check class="size-4 text-accent" />{/if}
      </button>
    {/each}
  </div>
</Popover>

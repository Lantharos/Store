<script lang="ts">
  let {
    checked = $bindable(false),
    label,
    onchange,
  }: { checked?: boolean; label: string; onchange?: (checked: boolean) => void } = $props()
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label={label}
  onclick={() => {
    checked = !checked
    onchange?.(checked)
  }}
  class="relative h-6 w-10 shrink-0 rounded-full transition-colors {checked ? 'bg-accent' : 'bg-well'}"
>
  <span
    class="knob absolute top-0.5 left-0.5 size-5 rounded-full bg-raised shadow-[0_1px_3px_rgb(0_0_0/0.2)] {checked ? 'translate-x-4' : ''}"
  ></span>
</button>

<style>
  .knob {
    transition: translate var(--spring-snappy-duration) var(--spring-snappy);
  }
</style>

<script lang="ts">
  let {
    name,
    file,
    backdrop,
    wide = false,
  }: { name: string; file: string; backdrop: "light" | "dark"; wide?: boolean } = $props()
</script>

<figure>
  <div class="grid aspect-[16/10] place-items-center rounded-tile p-8 ring-1 ring-hairline ring-inset {backdrop === 'light' ? 'bg-[#fcf9f3]' : 'bg-[#12110e]'}">
    <img src="/brand/{file}.svg" alt="" class={wide ? "h-12 sm:h-14" : "size-20 sm:size-24"} />
  </div>
  <figcaption class="mt-3 flex items-center gap-2 px-1">
    <span class="min-w-0 flex-1 truncate text-[15px] text-ink-soft">{name}</span>
    <a href="/brand/{file}.svg" download class="button button-sm button-quiet">SVG</a>
    <a href="/brand/{file}.png" download class="button button-sm button-quiet">PNG</a>
  </figcaption>
</figure>

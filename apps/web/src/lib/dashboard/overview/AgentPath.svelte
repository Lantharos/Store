<script lang="ts">
  let { class: className = "" }: { class?: string } = $props()
</script>

<p class="text-[13px] leading-relaxed text-ink-muted {className}">
  Or run <span class="font-mono text-ink-soft">bunx schelf login</span>, point your agent at <a href="/docs/terminal" class="text-ink-soft underline-offset-2 hover:underline">schelf.store/docs/terminal</a>, and let it do the rest.
</p>

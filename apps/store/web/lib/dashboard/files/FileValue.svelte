<script lang="ts">
  let { value, file, key }: { value: string | null | undefined; file: string; key: string } = $props()
</script>

<p class="text-[15px] leading-relaxed whitespace-pre-line {value ? 'text-ink' : 'text-ink-muted'}">{value || "Not set"}</p>
<p class="mt-1 font-mono text-[12px] text-ink-muted">{file} · {key}</p>

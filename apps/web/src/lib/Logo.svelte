<script lang="ts">
  let { class: className = "size-8" }: { class?: string } = $props()
</script>

<svg viewBox="0 0 64 64" aria-hidden="true" class="shrink-0 {className}">
  <rect width="64" height="64" rx="14" fill="var(--ink)" />
  <path d="M16.5 25h31a3 3 0 0 1 3 3.2l-1.3 16.6a5 5 0 0 1-5 4.6H19.8a5 5 0 0 1-5-4.6L13.5 28.2a3 3 0 0 1 3-3.2Z" fill="var(--canvas)" />
  <path d="M22 25a10 10 0 0 1 20 0h-5a5 5 0 0 0-10 0Z" fill="color-mix(in oklab, var(--canvas) 55%, var(--ink))" />
</svg>

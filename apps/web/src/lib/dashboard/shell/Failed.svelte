<script lang="ts">
  let { error, retry }: { error: Error; retry: () => unknown } = $props()
</script>

<div class="rounded-2xl bg-well p-6" role="alert">
  <p class="font-medium">This didn't load</p>
  <p class="mt-1 text-[15px] text-ink-soft">{error.message}</p>
  <button type="button" class="button button-sm button-quiet mt-4" onclick={retry}>Try again</button>
</div>

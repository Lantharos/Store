<script lang="ts">
  import { date } from "../../format.ts"

  interface Release {
    version: string
    published: string
    notes: string
  }

  let { releases }: { releases: Release[] } = $props()
  const [latest, ...older] = $derived(releases)
  let history = $state(false)
</script>

{#if latest}
  <section aria-labelledby="whats-new" class="mt-12">
    <h2 id="whats-new" class="text-xl font-semibold">What's new in {latest.version}</h2>
    <p class="mt-1 text-[15px] text-ink-muted"><time datetime={latest.published}>{date(latest.published)}</time></p>
    {#if latest.notes}
      <div class="notes mt-3 text-ink-soft">{@html latest.notes}</div>
    {/if}
    {#if older.length}
      <button type="button" class="mt-4 text-[15px] text-accent hover:underline" aria-expanded={history} onclick={() => (history = !history)}>
        {history ? "Hide version history" : "Version history"}
      </button>
      <div class="disclosure grid {history ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}" inert={!history}>
        <ol class="min-h-0 overflow-hidden">
          {#each older as release (release.version)}
            <li class="mt-6 border-t border-hairline pt-5">
              <p class="flex items-baseline justify-between gap-4">
                <span class="font-semibold">{release.version}</span>
                <time class="text-[13px] text-ink-muted" datetime={release.published}>{date(release.published)}</time>
              </p>
              {#if release.notes}<div class="notes mt-2 text-[15px] text-ink-soft">{@html release.notes}</div>{/if}
            </li>
          {/each}
        </ol>
      </div>
    {/if}
  </section>
{/if}

<style>
  .disclosure {
    transition: grid-template-rows var(--spring-smooth-duration) var(--spring-smooth);
  }

  .notes :global(ul) {
    list-style: disc;
    padding-left: 1.25rem;
  }

  .notes :global(li + li),
  .notes :global(p + p) {
    margin-top: 0.375rem;
  }

  .notes :global(li::marker) {
    color: var(--ink-muted);
  }

  .notes :global(a) {
    color: var(--accent);
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }
</style>

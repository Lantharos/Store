<script lang="ts">
  import type { Heading } from "../content/markdown.ts"

  let { headings }: { headings: Heading[] } = $props()
  let active = $state<string | null>(null)

  $effect(() => {
    const targets = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((node) => node !== null)
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) active = visible[0].target.id
      },
      { rootMargin: "0px 0px -70% 0px" },
    )
    for (const target of targets) observer.observe(target)
    return () => observer.disconnect()
  })
</script>

<nav aria-label="On this page" class="text-[13px]">
  <p class="font-medium text-ink">On this page</p>
  <ul class="mt-2 space-y-1.5 border-l border-hairline">
    {#each headings as heading (heading.id)}
      <li>
        <a
          href="#{heading.id}"
          aria-current={active === heading.id ? "location" : undefined}
          class="-ml-px block border-l py-0.5 pl-3 transition-colors {active === heading.id ? 'border-accent text-ink' : 'border-transparent text-ink-muted hover:text-ink'}"
        >
          {heading.text}
        </a>
      </li>
    {/each}
  </ul>
</nav>

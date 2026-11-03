<script lang="ts">
  import { categoryHref } from "../categories.ts"

  let {
    categories,
    current = null,
    class: className = "",
  }: { categories: { name: string; count: number }[]; current?: string | null; class?: string } = $props()
</script>

<nav aria-label="Categories" class="-mx-4 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0 {className}">
  <ul class="flex w-max gap-2 sm:w-auto sm:flex-wrap">
    <li>
      <a href="/categories" aria-current={current === "" ? "page" : undefined} class="button button-sm {current === '' ? 'button-ink' : 'button-quiet'}">All</a>
    </li>
    {#each categories as category (category.name)}
      {@const active = current === category.name}
      <li>
        <a href={categoryHref(category.name)} aria-current={active ? "page" : undefined} class="button button-sm {active ? 'button-ink' : 'button-quiet'}">
          {category.name}
        </a>
      </li>
    {/each}
  </ul>
</nav>

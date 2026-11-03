<script lang="ts">
  import Logo from "../../Logo.svelte"
  import SchemeSwitch from "../../theme/SchemeSwitch.svelte"

  const GROUPS = [
    {
      title: "Store",
      links: [
        ["/", "Discover"],
        ["/categories", "Categories"],
        ["/extensions", "Luft extensions"],
      ],
    },
    {
      title: "Developers",
      links: [
        ["/docs", "Publish an app"],
        ["/dashboard", "Dashboard"],
        ["/docs/review-guidelines", "Review guidelines"],
      ],
    },
    {
      title: "Legal",
      links: [
        ["/legal/terms", "Terms"],
        ["/legal/privacy", "Privacy"],
        ["/legal/developer-agreement", "Developer agreement"],
        ["/legal/contact", "Contact and imprint"],
      ],
    },
  ]
</script>

<footer class="page mt-24 pb-12 text-[15px]">
  <div class="grid gap-10 border-t border-hairline pt-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
    <div class="space-y-4">
      <a href="/" class="flex items-center gap-2.5 font-semibold"><Logo class="size-7" />Schelf</a>
      <p class="max-w-xs leading-relaxed text-ink-muted">Apps for Luft, Linux, Windows and macOS. Every release is checked by a person, and nobody is tracked.</p>
      <SchemeSwitch />
    </div>
    {#each GROUPS as group (group.title)}
      <nav aria-label={group.title} class="space-y-3">
        <p class="font-medium">{group.title}</p>
        <ul class="space-y-2">
          {#each group.links as [href, label] (href)}
            <li><a {href} class="text-ink-muted transition-colors hover:text-ink">{label}</a></li>
          {/each}
        </ul>
      </nav>
    {/each}
  </div>
  <p class="mt-10 text-[13px] text-ink-muted">Schelf is made by Lantharos. Apps belong to their developers.</p>
</footer>

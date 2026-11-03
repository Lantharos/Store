<script lang="ts">
  import CornerDownLeft from "@lucide/svelte/icons/corner-down-left"
  import Search from "@lucide/svelte/icons/search"
  import { goto } from "$app/navigation"
  import { page } from "$app/state"
  import AppIcon from "../../store/apps/AppIcon.svelte"
  import { scheme } from "../../theme/scheme.svelte.ts"
  import Dialog from "../../ui/overlay/Dialog.svelte"
  import { session } from "../api/session.svelte.ts"
  import {
    accountSections,
    publisherSections,
    sectionAfterSwitch,
    settingsHref,
  } from "../settings/sections.ts"

  let { open = $bindable(false) }: { open?: boolean } = $props()

  interface Command {
    id: string
    label: string
    group: string
    hint?: string
    icon?: { src: string | null; name: string }
    run: () => unknown
  }

  let query = $state("")
  let active = $state(0)
  let list = $state<HTMLElement>()

  const currentApp = $derived(
    session.apps.find((app) => page.url.pathname.startsWith(`/dashboard/apps/${app.id}`)),
  )

  const commands = $derived.by<Command[]>(() => {
    const go = (href: string) => () => goto(href)
    const appCommands = session.apps.map((app) => ({
      id: `app:${app.id}`,
      label: app.name,
      hint: app.id,
      group: "Apps",
      icon: { src: app.icon, name: app.name },
      run: go(`/dashboard/apps/${app.id}`),
    }))
    const sections = currentApp
      ? [
          ["Releases", ""],
          ["Listing", "/listing"],
          ["Publishing", "/publishing"],
          ["Stats", "/stats"],
        ].map(([label, suffix]) => ({
          id: `section:${label}`,
          label: `${label}`,
          hint: currentApp.name,
          group: currentApp.name,
          run: go(`/dashboard/apps/${currentApp.id}${suffix}`),
        }))
      : []
    const pages: Command[] = [
      { id: "new", label: "Add an app", group: "Go to", run: go("/dashboard/apps/new") },
      { id: "settings", label: "Settings", group: "Go to", run: go(settingsHref("profile")) },
      {
        id: "organisation",
        label: "New organisation",
        group: "Go to",
        run: go("/dashboard/organisations/new"),
      },
      ...(session.publisher ? [...publisherSections(session.publisher), ...accountSections] : []).map(
        (section) => ({
          id: `settings:${section.slug}`,
          label: section.label,
          hint: "Settings",
          group: "Settings",
          run: go(settingsHref(section.slug)),
        }),
      ),
      { id: "docs", label: "Documentation", group: "Go to", run: go("/docs") },
      { id: "store", label: "The store", group: "Go to", run: go("/") },
      { id: "light", label: "Use light appearance", group: "Appearance", run: () => scheme.set("light") },
      { id: "dark", label: "Use dark appearance", group: "Appearance", run: () => scheme.set("dark") },
      {
        id: "system",
        label: "Match the system's appearance",
        group: "Appearance",
        run: () => scheme.set("system"),
      },
    ]
    const publishers = (session.account?.publishers ?? [])
      .filter((publisher) => publisher.id !== session.publisher?.id)
      .map((publisher) => ({
        id: `publisher:${publisher.id}`,
        label: `Switch to ${publisher.name}`,
        group: "Publishers",
        icon: { src: publisher.logo, name: publisher.name },
        run: () =>
          session
            .use(publisher.id)
            .then(() => goto(sectionAfterSwitch(page.url.pathname, publisher) ?? "/dashboard")),
      }))
    return [...sections, ...appCommands, ...publishers, ...pages]
  })

  function score(command: Command, words: string[]) {
    const haystack = `${command.label} ${command.hint ?? ""} ${command.group}`.toLowerCase()
    let total = 0
    for (const word of words) {
      const at = haystack.indexOf(word)
      if (at < 0) return -1
      total += at === 0 || haystack[at - 1] === " " || haystack[at - 1] === "." ? 2 : 1
    }
    return total
  }

  const results = $derived.by(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    if (!words.length) return commands
    return commands
      .map((command) => ({ command, score: score(command, words) }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.command)
  })

  $effect(() => {
    if (open) {
      query = ""
      active = 0
    }
  })

  $effect(() => {
    list?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" })
  })

  function run(command: Command | undefined) {
    if (!command) return
    open = false
    void command.run()
  }

  function keydown(event: KeyboardEvent) {
    if (event.key === "ArrowDown") active = Math.min(active + 1, results.length - 1)
    else if (event.key === "ArrowUp") active = Math.max(active - 1, 0)
    else if (event.key === "Enter") run(results[active])
    else return
    event.preventDefault()
  }
</script>

<Dialog bind:open label="Go to" class="max-w-lg overflow-hidden">
  <label class="flex items-center gap-3 border-b border-hairline px-5">
    <Search class="size-[18px] text-ink-muted" />
    <input
      bind:value={query}
      oninput={() => (active = 0)}
      onkeydown={keydown}
      placeholder="Go to an app or page"
      aria-label="Go to"
      role="combobox"
      aria-expanded="true"
      aria-controls="palette-results"
      aria-activedescendant="palette-{active}"
      class="h-14 flex-1 bg-transparent text-[17px] outline-none placeholder:text-ink-muted"
    />
  </label>
  <div bind:this={list} id="palette-results" role="listbox" aria-label="Results" class="max-h-[min(24rem,60vh)] overflow-y-auto p-2">
    {#each results as command, index (command.id)}
      {#if index === 0 || results[index - 1]!.group !== command.group}
        <p class="px-3 pt-3 pb-1 text-[13px] text-ink-muted">{command.group}</p>
      {/if}
      <button
        id="palette-{index}"
        data-index={index}
        type="button"
        role="option"
        tabindex="-1"
        aria-selected={index === active}
        onpointermove={() => (active = index)}
        onclick={() => run(command)}
        class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[15px] {index === active ? 'bg-well' : ''}"
      >
        {#if command.icon}<AppIcon src={command.icon.src} name={command.icon.name} class="size-6 text-xs" />{/if}
        <span class="flex-1 truncate">{command.label}</span>
        {#if command.hint && command.group === "Apps"}<span class="truncate font-mono text-xs text-ink-muted">{command.hint}</span>{/if}
        {#if index === active}<CornerDownLeft class="size-3.5 text-ink-muted" />{/if}
      </button>
    {:else}
      <p class="px-3 py-6 text-center text-[15px] text-ink-muted">Nothing matches “{query}”.</p>
    {/each}
  </div>
</Dialog>

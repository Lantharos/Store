<script lang="ts">
  import type { AppSettings, ListingMeta, ListingSource, ListingText } from "@schelf/protocol"
  import { untrack } from "svelte"
  import { CATEGORY_CHOICES, categoryLabel } from "../../store/categories.ts"
  import ColorField from "../../ui/fields/ColorField.svelte"
  import Field from "../../ui/fields/Field.svelte"
  import Select from "../../ui/fields/Select.svelte"
  import { toasts } from "../../ui/overlay/toasts.svelte.ts"
  import { api } from "../api/client.ts"
  import { endpoints } from "../api/endpoints.ts"
  import { session } from "../api/session.svelte.ts"
  import IconField from "./IconField.svelte"
  import Preview from "./Preview.svelte"
  import Screenshots from "./Screenshots.svelte"
  import Section from "./Section.svelte"

  let { settings, onsaved }: { settings: AppSettings; onsaved: (settings: AppSettings) => void } = $props()

  const LOCALE_NAMES: Record<string, string> = {
    en: "English",
    de: "German",
    fr: "French",
    es: "Spanish",
    it: "Italian",
    nl: "Dutch",
    pl: "Polish",
    pt: "Portuguese",
    ja: "Japanese",
  }
  const MAX_CATEGORIES = 4
  const SOURCE_NOTES: Partial<Record<ListingSource, string>> = {
    appstream: "From your AppStream file",
    sabine: "From Sabine.toml",
  }
  const textNote = (field: string) =>
    SOURCE_NOTES[settings.listing_sources[locale]?.[field] ?? "dashboard"] ?? null
  const metaNote = (field: string) => SOURCE_NOTES[settings.meta_sources[field] ?? "dashboard"] ?? null

  let locale = $state("en")
  let listing = $state(untrack(() => $state.snapshot(settings.listing)))
  let meta = $state<ListingMeta>(untrack(() => $state.snapshot(settings.meta)))
  let screenshots = $state(untrack(() => $state.snapshot(settings.screenshots)))
  let saving = $state(false)

  const empty: ListingText = { name: "", summary: "", description: "", keywords: [] }
  const text = $derived(listing[locale] ?? empty)
  const dirty = $derived(
    JSON.stringify(listing) !== JSON.stringify(settings.listing) ||
      JSON.stringify(meta) !== JSON.stringify(settings.meta),
  )
  const locales = $derived(
    [...new Set([...Object.keys(listing), ...Object.keys(LOCALE_NAMES)])].map((code) => ({
      value: code,
      label: `${LOCALE_NAMES[code] ?? code}${listing[code] ? "" : " (add)"}`,
    })),
  )

  function chooseLocale(code: string) {
    if (!listing[code]) listing[code] = $state.snapshot(listing.en ?? empty)
    locale = code
  }

  function toggleCategory(name: string) {
    meta.categories = meta.categories.includes(name)
      ? meta.categories.filter((category) => category !== name)
      : [...meta.categories, name].slice(0, MAX_CATEGORIES)
  }

  function discard() {
    listing = $state.snapshot(settings.listing)
    meta = $state.snapshot(settings.meta)
  }

  const changedLocales = () =>
    Object.keys(listing).filter(
      (code) => JSON.stringify(listing[code]) !== JSON.stringify(settings.listing[code]),
    )

  async function save() {
    saving = true
    try {
      const { icon: _icon, ...metaChanges } = meta
      const [saved] = await Promise.all([
        ...changedLocales().map((code) =>
          api.put<AppSettings>(endpoints.listing(settings.app.id, code), listing[code]),
        ),
        api.patch<AppSettings>(endpoints.meta(settings.app.id), metaChanges),
      ])
      onsaved({ ...saved!, listing: $state.snapshot(listing), meta: $state.snapshot(meta), screenshots })
      toasts.show("Listing saved. It's live on your page within a few minutes.")
    } catch (error) {
      toasts.error(error)
    } finally {
      saving = false
    }
  }

  function keydown(event: KeyboardEvent) {
    if (event.key === "s" && (event.metaKey || event.ctrlKey) && dirty) {
      event.preventDefault()
      void save()
    }
  }
</script>

<svelte:window onkeydown={keydown} onbeforeunload={(event) => dirty && event.preventDefault()} />

<div class="grid gap-10 xl:grid-cols-[minmax(0,1fr)_24rem]">
  <div class="min-w-0 space-y-12">
    <Section title="Words" text="What people read first. Keep the summary to one line about what it does, not how.">
      {#snippet aside()}
        <div class="w-44"><Select value={locale} options={locales} label="Language" onchange={chooseLocale} /></div>
      {/snippet}
      <Field label="Name" note={textNote("name")} count={{ used: text.name.length, max: 60 }}>
        <input class="field" bind:value={listing[locale]!.name} maxlength="60" />
      </Field>
      <Field label="Summary" note={textNote("summary")} count={{ used: text.summary.length, max: 120 }}>
        <input class="field" bind:value={listing[locale]!.summary} maxlength="120" />
      </Field>
      <Field label="Description" note={textNote("description")} hint="Plain paragraphs and lists. Links and **bold** work.">
        <textarea class="field min-h-48 resize-y py-3 leading-relaxed" bind:value={listing[locale]!.description} maxlength="10000"></textarea>
      </Field>
      <Field label="Search words" note={textNote("keywords")} hint="Other words people might search for, separated by commas.">
        <input
          class="field"
          value={text.keywords.join(", ")}
          onchange={(event) => (listing[locale]!.keywords = event.currentTarget.value.split(",").map((word) => word.trim()).filter(Boolean).slice(0, 20))}
        />
      </Field>
    </Section>

    <Section title="Pictures" text="Your icon, and screenshots of the app doing what it's for.">
      <IconField appId={settings.app.id} bind:icon={meta.icon} name={text.name} />
      <Screenshots appId={settings.app.id} bind:screenshots />
    </Section>

    <Section title="Details">
      <Field label="Categories" note={metaNote("categories")} hint="Up to four. The first is the one shown under your name.">
        <div class="flex flex-wrap gap-2">
          {#each [...new Set([...settings.meta.categories, ...CATEGORY_CHOICES])] as name (name)}
            {@const chosen = meta.categories.includes(name)}
            <button type="button" aria-pressed={chosen} onclick={() => toggleCategory(name)} disabled={!chosen && meta.categories.length >= MAX_CATEGORIES} class="button button-sm {chosen ? 'button-ink' : 'button-quiet'}">
              {categoryLabel(name)}
            </button>
          {/each}
        </div>
      </Field>
      <div class="grid gap-6 sm:grid-cols-2">
        <Field label="Website" note={metaNote("homepage")}><input class="field" type="url" placeholder="https://" bind:value={meta.homepage} /></Field>
        <Field label="Help and support" note={metaNote("support")}><input class="field" type="url" placeholder="https://" bind:value={meta.support} /></Field>
        <Field label="Privacy policy" note={metaNote("privacy_url")} hint="Needed if your app sends anything about people anywhere."><input class="field" type="url" placeholder="https://" bind:value={meta.privacy_url} /></Field>
      </div>
      <Field label="Colour" note={metaNote("brand_color")} hint="Used behind your app when it's featured.">
        <ColorField bind:value={meta.brand_color} label="Colour" />
      </Field>
    </Section>
  </div>

  <aside class="xl:sticky xl:top-8 xl:self-start">
    <Preview text={text} {meta} {screenshots} developer={session.account?.developer?.name ?? ""} extension={settings.app.kind === "extension"} appId={settings.app.id} />
  </aside>
</div>

{#if dirty}
  <div class="savebar fixed inset-x-3 bottom-3 z-30 mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-ink py-2.5 pr-2.5 pl-5 text-canvas shadow-float lg:left-[calc(16rem+1rem)]">
    <span class="flex-1 text-[15px]">Unsaved changes</span>
    <button type="button" class="button button-sm text-canvas/80 hover:text-canvas" onclick={discard}>Discard</button>
    <button type="button" class="button button-sm bg-canvas text-ink" disabled={saving} onclick={save}>{saving ? "Saving…" : "Save"}</button>
  </div>
{/if}

<style>
  @media (prefers-reduced-motion: no-preference) {
    .savebar {
      animation: up var(--spring-smooth-duration) var(--spring-smooth) both;
    }
  }

  @keyframes up {
    from {
      translate: 0 150%;
    }
  }
</style>

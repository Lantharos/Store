<script lang="ts">
  import type { AppSettings, ListingMeta, ListingText } from "@schelf/protocol"
  import { untrack } from "svelte"
  import ColorField from "../../ui/fields/ColorField.svelte"
  import Field from "../../ui/fields/Field.svelte"
  import Select from "../../ui/fields/Select.svelte"
  import { toasts } from "../../ui/overlay/toasts.svelte.ts"
  import { api } from "../api/client.ts"
  import { endpoints } from "../api/endpoints.ts"
  import { session } from "../api/session.svelte.ts"
  import FileValue from "../files/FileValue.svelte"
  import { listingFile } from "../files/files.ts"
  import CategoryPicker from "./CategoryPicker.svelte"
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
  const file = $derived(listingFile(settings))
  const wordKey = (field: string) => (locale === "en" ? field : `translations.${locale}.${field}`)

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
    [...new Set([...Object.keys(listing), ...Object.keys(LOCALE_NAMES)])]
      .map((code) => ({
        value: code,
        label: `${LOCALE_NAMES[code] ?? code}${listing[code] ? "" : " (add)"}`,
      }))
      .filter((option) => !file || listing[option.value]),
  )

  function chooseLocale(code: string) {
    if (!listing[code]) listing[code] = $state.snapshot(listing.en ?? empty)
    locale = code
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
      {#if file}
        <Field label="Name"><FileValue value={text.name} {file} key={wordKey("name")} /></Field>
        <Field label="Summary"><FileValue value={text.summary} {file} key={wordKey("summary")} /></Field>
        <Field label="Description"><FileValue value={text.description} {file} key={wordKey("description")} /></Field>
        <Field label="Search words"><FileValue value={text.keywords.join(", ")} {file} key={wordKey("keywords")} /></Field>
      {:else}
      <Field label="Name" count={{ used: text.name.length, max: 60 }}>
        <input class="field" bind:value={listing[locale]!.name} maxlength="60" />
      </Field>
      <Field label="Summary" count={{ used: text.summary.length, max: 120 }}>
        <input class="field" bind:value={listing[locale]!.summary} maxlength="120" />
      </Field>
      <Field label="Description" hint="Plain paragraphs and lists. Links and **bold** work.">
        <textarea class="field min-h-48 resize-y py-3 leading-relaxed" bind:value={listing[locale]!.description} maxlength="10000"></textarea>
      </Field>
      <Field label="Search words" hint="Other words people might search for, separated by commas.">
        <input
          class="field"
          value={text.keywords.join(", ")}
          onchange={(event) => (listing[locale]!.keywords = event.currentTarget.value.split(",").map((word) => word.trim()).filter(Boolean).slice(0, 20))}
        />
      </Field>
      {/if}
    </Section>

    <Section
      title="Pictures"
      text={settings.app.kind === "extension"
        ? "Your icon, and screenshots of the extension at work. Lists show the first screenshot cropped to a 2:1 strip from the middle, with your icon in its lower left corner."
        : "Your icon, and screenshots of the app doing what it's for."}
    >
      <IconField appId={settings.app.id} bind:icon={meta.icon} name={text.name} {file} />
      <Screenshots appId={settings.app.id} bind:screenshots {file} />
    </Section>

    <Section title="Details">
      {#if file}
        <Field label="Categories"><FileValue value={meta.categories.join(", ")} {file} key="categories" /></Field>
        <div class="grid gap-6 sm:grid-cols-2">
          <Field label="Website"><FileValue value={meta.homepage} {file} key="homepage" /></Field>
          <Field label="Help and support"><FileValue value={meta.support} {file} key="support" /></Field>
          <Field label="Privacy policy"><FileValue value={meta.privacy_url} {file} key="privacy_url" /></Field>
          <Field label="Colour"><FileValue value={meta.brand_color} {file} key="brand_color" /></Field>
        </div>
      {:else}
        <Field label="Categories" hint="Up to four. Drag to change the order; the first one is your primary category.">
          <CategoryPicker bind:categories={meta.categories} saved={settings.meta.categories} />
        </Field>
        <div class="grid gap-6 sm:grid-cols-2">
          <Field label="Website"><input class="field" type="url" placeholder="https://" bind:value={meta.homepage} /></Field>
          <Field label="Help and support"><input class="field" type="url" placeholder="https://" bind:value={meta.support} /></Field>
          <Field label="Privacy policy" hint="Needed if your app sends anything about people anywhere."><input class="field" type="url" placeholder="https://" bind:value={meta.privacy_url} /></Field>
        </div>
        <Field label="Colour" hint="Used behind your app when it's featured.">
          <ColorField bind:value={meta.brand_color} label="Colour" />
        </Field>
      {/if}
    </Section>
  </div>

  <aside class="xl:sticky xl:top-8 xl:self-start">
    <Preview text={text} {meta} {screenshots} publisher={session.publisher?.name ?? ""} extension={settings.app.kind === "extension"} appId={settings.app.id} />
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

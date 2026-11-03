<script lang="ts">
  import CircleCheck from "@lucide/svelte/icons/circle-check"
  import { untrack } from "svelte"
  import Meta from "#lib/seo/Meta.svelte"
  import AppIcon from "#lib/store/apps/AppIcon.svelte"
  import Field from "#lib/ui/fields/Field.svelte"
  import { enhance } from "$app/forms"

  let { data, form } = $props()

  const KINDS = [
    { value: "abuse", title: "It's harmful", text: "Malware, a scam, or it does something it doesn't say." },
    { value: "dsa", title: "It's illegal", text: "Content or behaviour that breaks the law where you live." },
    {
      value: "dmca",
      title: "It uses my work",
      text: "Your code, name, logo or other work without permission.",
    },
    {
      value: "security",
      title: "A security problem",
      text: "A vulnerability the developer and we should know about.",
    },
  ] as const

  let kind = $state<string>(untrack(() => form?.report?.kind ?? ""))
  let busy = $state(false)
  const appPath = $derived(`/${data.app.kind === "extension" ? "extensions" : "apps"}/${data.app.id}`)
</script>

<Meta title="Report {data.app.name} · Schelf" description="Tell Schelf about a problem with {data.app.name}." path="/report/{data.app.id}" indexed={false} />

<div class="page max-w-2xl!">
  <a href={appPath} class="mt-6 flex items-center gap-3 sm:mt-10">
    <AppIcon src={data.app.icon} name={data.app.name} class="size-10" />
    <span class="font-medium">{data.app.name}</span>
  </a>

  {#if form?.sent}
    <section class="enter mt-10">
      <CircleCheck class="size-8 text-accent" />
      <h1 class="mt-4 text-[28px] font-semibold tracking-[-0.02em]">Thanks, we have it</h1>
      <p class="mt-2 leading-relaxed text-ink-soft">
        A person will look at your report. If you left an email, you'll get a confirmation now and another when we've
        decided what to do.
      </p>
      <a href={appPath} class="button button-quiet mt-6">Back to {data.app.name}</a>
    </section>
  {:else}
    <h1 class="mt-8 text-[28px] font-semibold tracking-[-0.02em] sm:text-[34px]">Report a problem</h1>
    <p class="mt-2 leading-relaxed text-ink-soft">
      A person reads every report. If something is dangerous, we can stop it from running on every computer within the
      hour.
    </p>

    <form
      method="POST"
      class="mt-8 space-y-6"
      use:enhance={() => {
        busy = true
        return async ({ update }) => {
          await update({ reset: false })
          busy = false
        }
      }}
    >
      <fieldset>
        <legend class="text-[15px] font-medium">What kind of problem is it?</legend>
        <input type="hidden" name="kind" value={kind} />
        <div role="radiogroup" aria-label="Kind of problem" class="mt-2 grid gap-2 sm:grid-cols-2">
          {#each KINDS as option (option.value)}
            <button
              type="button"
              role="radio"
              aria-checked={kind === option.value}
              onclick={() => (kind = option.value)}
              class="flex flex-col justify-start rounded-2xl p-4 text-left transition-[background-color,box-shadow] {kind === option.value
                ? 'bg-raised shadow-[0_0_0_2px_var(--accent)]'
                : 'bg-well hover:bg-[color-mix(in_oklab,var(--well)_85%,var(--ink))]'}"
            >
              <span class="block font-medium">{option.title}</span>
              <span class="mt-0.5 block text-[13px] leading-relaxed text-ink-muted">{option.text}</span>
            </button>
          {/each}
        </div>
      </fieldset>

      <Field label="In a few words">
        <input name="reason" class="field" maxlength="200" required value={form?.report?.reason ?? ""} placeholder="It uploads my files without asking" />
      </Field>
      <Field label="What happened" hint="What you saw, when, and anything that helps us check it.">
        <textarea name="explanation" class="field h-36 resize-y py-3" maxlength="5000" required>{form?.report?.explanation ?? ""}</textarea>
      </Field>
      <Field label="Where exactly" hint="A screenshot's position, a version number, or a link. Optional.">
        <input name="location" class="field" maxlength="500" value={form?.report?.location ?? ""} />
      </Field>
      <div class="grid gap-6 sm:grid-cols-2">
        <Field label="Your name">
          <input name="name" class="field" autocomplete="name" maxlength="200" value={form?.report?.name ?? ""} />
        </Field>
        <Field label="Your email" hint={kind === "dmca" ? "Needed for a copyright notice." : "So we can tell you what we did."}>
          <input name="email" type="email" class="field" autocomplete="email" value={form?.report?.email ?? ""} />
        </Field>
      </div>

      {#if form?.error}<p class="text-[15px] text-danger" role="alert">{form.error}</p>{/if}

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-[13px] text-ink-muted">How we handle reports: <a href="/legal/terms#reports" class="link">our terms</a>.</p>
        <button class="button button-primary" disabled={busy}>Send report</button>
      </div>
    </form>
  {/if}
</div>

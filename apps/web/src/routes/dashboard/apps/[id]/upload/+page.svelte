<script lang="ts">
  import { appSettings } from "#lib/dashboard/apps/context.ts"
  import UploadForm from "#lib/dashboard/upload/UploadForm.svelte"
  import { goto } from "$app/navigation"

  const settings = $derived(appSettings()())
  const app = $derived(settings.data!.app)
</script>

<svelte:head><title>Upload · {app.name} · Schelf for developers</title></svelte:head>

<div class="grid gap-12 xl:grid-cols-[minmax(0,1fr)_22rem]">
  <section class="min-w-0">
    <h2 class="text-xl font-semibold">Upload a release</h2>
    <p class="mt-1.5 max-w-xl text-[15px] leading-relaxed text-ink-soft">For builds made on your own computer or another CI. A person reviews every upload before it goes out, so it takes longer than publishing from GitHub Actions.</p>
    <div class="mt-8"><UploadForm settings={settings.data!} onsent={(release) => goto(`/dashboard/apps/${app.id}/releases/${release}`)} /></div>
  </section>
  <aside class="space-y-6">
    <section class="rounded-group bg-raised p-5 sm:p-6">
      <h2 class="font-semibold">What happens next</h2>
      <ol class="mt-3 space-y-2 text-[15px] leading-relaxed text-ink-soft">
        <li>Schelf checks each file's hash as it arrives.</li>
        <li>The files are scanned for malware and looked through.</li>
        <li>A person reviews the release, usually within a day.</li>
        <li>It rolls out, and your links follow.</li>
      </ol>
    </section>
    <section class="rounded-group bg-raised p-5 sm:p-6">
      <h2 class="font-semibold">From a terminal</h2>
      <p class="mt-1 text-[15px] leading-relaxed text-ink-muted">Make a token in <a href="/dashboard/apps/{app.id}/settings" class="link">Settings</a>, then run schelf publish with the files.</p>
    </section>
  </aside>
</div>

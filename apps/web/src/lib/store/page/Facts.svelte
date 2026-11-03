<script lang="ts">
  import type { AppIndex, Installs } from "@schelf/protocol"
  import { count, date } from "../../format.ts"
  import { systemsOf } from "../../system/artifacts.ts"

  let { app, installs }: { app: AppIndex; installs: Installs } = $props()

  const latest = $derived(app.releases[0])
  const systems = $derived(systemsOf(latest?.artifacts.map((artifact) => artifact.platform) ?? []))
  const repository = $derived(app.repository?.replace(/^https?:\/\//, ""))
  const built = $derived(
    latest?.provenance.origin === "github-actions"
      ? { text: `On GitHub from ${latest.provenance.tag ?? "a tag"}`, href: latest.provenance.run }
      : latest
        ? { text: "Uploaded by the developer", href: null }
        : null,
  )
</script>

<dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-[15px]">
  {#if latest}
    <dt class="text-ink-muted">Version</dt>
    <dd>{latest.version}</dd>
    <dt class="text-ink-muted">Updated</dt>
    <dd><time datetime={latest.published}>{date(latest.published)}</time></dd>
  {/if}
  {#if built}
    <dt class="text-ink-muted">Built</dt>
    <dd>{#if built.href}<a href={built.href} class="link" rel="nofollow">{built.text}</a>{:else}{built.text}{/if}</dd>
  {/if}
  {#if app.licence}
    <dt class="text-ink-muted">Licence</dt>
    <dd>{app.licence}</dd>
  {/if}
  {#if app.repository}
    <dt class="text-ink-muted">Source</dt>
    <dd class="min-w-0"><a href={app.repository} class="link block truncate" rel="nofollow">{repository}</a></dd>
  {/if}
  <dt class="text-ink-muted">Installs</dt>
  <dd>{count(installs.total)}<span class="text-ink-muted">{" · "}{count(installs.last_30_days)} this month</span></dd>
  {#if systems.length}
    <dt class="text-ink-muted">Systems</dt>
    <dd>{systems.join(", ")}</dd>
  {/if}
  {#if app.homepage}
    <dt class="text-ink-muted">Website</dt>
    <dd class="min-w-0"><a href={app.homepage} class="link block truncate" rel="nofollow">{app.homepage.replace(/^https?:\/\//, "")}</a></dd>
  {/if}
  {#if app.support}
    <dt class="text-ink-muted">Help</dt>
    <dd><a href={app.support} class="link" rel="nofollow">Get support</a></dd>
  {/if}
  {#if app.privacy_url}
    <dt class="text-ink-muted">Privacy</dt>
    <dd><a href={app.privacy_url} class="link" rel="nofollow">Privacy policy</a></dd>
  {/if}
</dl>

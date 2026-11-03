<script lang="ts">
  import type { Links } from "@schelf/protocol"
  import CodeBlock from "../../code/CodeBlock.svelte"
  import CopyButton from "../../code/CopyButton.svelte"
  import Group from "../../ui/group/Group.svelte"
  import Row from "../../ui/group/Row.svelte"

  let { links }: { links: Links } = $props()

  const rows = $derived([
    {
      title: "Page",
      description: "Everything about the project, with every file, checksum and version.",
      url: links.page,
    },
    {
      title: "Download",
      description:
        "Sends each visitor the file for their system. Add a system to pin one, like /latest/windows.",
      url: links.latest,
    },
    {
      title: "As JSON",
      description: "The newest version and every file, for your own site or scripts.",
      url: links.json,
    },
  ])
</script>

<Group title="Links" description="They always point at the newest release, so they never go stale." rows>
  {#each rows as row (row.title)}
    <Row title={row.title} description={row.description}>
      <CopyButton text={row.url} label="Copy" />
      {#snippet below()}<p class="truncate font-mono text-[13px] text-ink-soft">{row.url}</p>{/snippet}
    </Row>
  {/each}
</Group>

<section class="mt-10">
  <h2 class="px-1 font-semibold">Download button for your site</h2>
  <p class="mt-0.5 px-1 text-[13px] leading-relaxed text-ink-muted">A plain link that works everywhere. The script turns it into "Download for macOS" with the right file for each visitor; style it like any other link.</p>
  <div class="mt-3"><CodeBlock lang="html" code={links.embed} /></div>
</section>

{#if links.feeds.length}
  <Group class="mt-10" title="Update feed" description="Point your app's updater here." rows>
    {#each links.feeds as feed (feed.url)}
      <Row title={feed.name}>
        <CopyButton text={feed.url} label="Copy" />
        {#snippet below()}<p class="truncate font-mono text-[13px] text-ink-soft">{feed.url}</p>{/snippet}
      </Row>
    {/each}
  </Group>
{/if}

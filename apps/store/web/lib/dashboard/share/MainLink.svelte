<script lang="ts">
  import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right"
  import CopyButton from "../../code/CopyButton.svelte"

  let { link, page, released }: { link: string; page: string; released: boolean } = $props()
  const shown = (url: string) => url.replace(/^https?:\/\//, "")
</script>

<section class="rounded-group bg-raised p-5 sm:p-7">
  <p class="text-[15px] text-ink-soft">Everyone gets the right file for their computer from this one link.</p>
  <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
    <p class="field flex min-w-0 flex-1 items-center font-mono text-[14px] select-all"><span class="truncate">{shown(link)}</span></p>
    <CopyButton text={link} label="Copy link" primary />
  </div>
  <p class="mt-3 text-[13px] leading-relaxed text-ink-muted">
    {released ? "It always points at the newest release, so it never goes stale." : "It starts working as soon as the first release is out."}
  </p>
  <div class="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-hairline pt-4 text-[15px]">
    <span class="text-ink-muted">Its page</span>
    <a href={page} target="_blank" class="flex min-w-0 items-center gap-1 text-ink-soft hover:text-ink"><span class="truncate font-mono text-[13px]">{shown(page)}</span><ArrowUpRight class="size-3.5 shrink-0" /></a>
    <CopyButton text={page} label="Copy page link" compact class="ml-auto" />
  </div>
</section>

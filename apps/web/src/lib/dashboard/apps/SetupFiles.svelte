<script lang="ts">
  import type { SetupFiles } from "@schelf/protocol"
  import CodeBlock from "../../code/CodeBlock.svelte"

  let { setup }: { setup: SetupFiles } = $props()
  const commit = $derived(
    `git add schelf.toml ${setup.workflow_path}\ngit commit -m "Publish on Schelf"\ngit push`,
  )
</script>

<div class="space-y-4">
  <CodeBlock title="schelf.toml" lang="toml" code={setup.schelf_toml} />
  <CodeBlock title={setup.workflow_path} lang="yaml" code={setup.workflow_yml} />
  <CodeBlock lang="sh" code={commit} />
</div>

<script lang="ts">
  import Choice from "../../ui/fields/Choice.svelte"
  import { KINDS, type ProjectKind } from "./kinds.ts"

  let { chosen, onchoose }: { chosen: ProjectKind | null; onchoose: (kind: ProjectKind) => void } = $props()
</script>

<div role="radiogroup" aria-label="What you're making" class="grid gap-3 sm:grid-cols-2">
  {#each Object.entries(KINDS) as [kind, info] (kind)}
    <Choice title={info.title} text={info.text} icon={info.icon} chosen={chosen === kind} onclick={() => onchoose(kind as ProjectKind)} />
  {/each}
</div>

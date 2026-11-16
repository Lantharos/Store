<script lang="ts">
  import Choice from "../../ui/fields/Choice.svelte"
  import { KINDS, type ProjectKind } from "./kinds.ts"

  let { chosen, onchoose }: { chosen: ProjectKind | null; onchoose: (kind: ProjectKind) => void } = $props()

  const options = Object.entries(KINDS).map(([kind, info]) => ({
    value: kind as ProjectKind,
    title: info.title,
    text: info.text,
    icon: info.icon,
  }))
</script>

<Choice label="What you're making" {options} value={chosen} followFocus={false} onchange={onchoose} class="grid gap-3 sm:grid-cols-2" />

<script lang="ts">
  import Monitor from "@lucide/svelte/icons/monitor"
  import Moon from "@lucide/svelte/icons/moon"
  import Sun from "@lucide/svelte/icons/sun"
  import { onMount } from "svelte"
  import Segmented from "../ui/fields/Segmented.svelte"
  import { type Scheme, scheme } from "./scheme.svelte.ts"

  onMount(() => scheme.load())

  const options: { value: Scheme; label: string; icon: typeof Sun }[] = [
    { value: "system", label: "Auto", icon: Monitor },
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
  ]
</script>

<Segmented value={scheme.value} {options} label="Appearance" size="sm" onchange={(next) => scheme.set(next)} />

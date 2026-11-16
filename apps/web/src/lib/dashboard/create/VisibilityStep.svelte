<script lang="ts">
  import Eye from "@lucide/svelte/icons/eye"
  import Link from "@lucide/svelte/icons/link"
  import type { Visibility } from "@schelf/protocol"
  import Choice from "../../ui/fields/Choice.svelte"

  let { visibility = $bindable() }: { visibility: Visibility } = $props()
</script>

<Choice
  label="Who finds it"
  bind:value={visibility}
  options={[
    {
      value: "listed",
      title: "Listed",
      text: "In the store, in search and in Schelf on Luft, where people install it in a click. A person reviews every release before it goes out.",
      icon: Eye,
    },
    {
      value: "unlisted",
      title: "Unlisted",
      text: "Only people with the link find it. Releases from GitHub go out as soon as Schelf's checks pass, and you can ask to list it later.",
      icon: Link,
    },
  ]}
/>

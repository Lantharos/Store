<script lang="ts">
  import AudioLines from "@lucide/svelte/icons/audio-lines"
  import Bell from "@lucide/svelte/icons/bell"
  import BellOff from "@lucide/svelte/icons/bell-off"
  import CloudSun from "@lucide/svelte/icons/cloud-sun"
  import Cpu from "@lucide/svelte/icons/cpu"
  import Globe from "@lucide/svelte/icons/globe"
  import Image from "@lucide/svelte/icons/image"
  import Keyboard from "@lucide/svelte/icons/keyboard"
  import Lock from "@lucide/svelte/icons/lock"
  import MapPin from "@lucide/svelte/icons/map-pin"
  import Music from "@lucide/svelte/icons/music"
  import PanelBottom from "@lucide/svelte/icons/panel-bottom"
  import PanelTop from "@lucide/svelte/icons/panel-top"
  import Phone from "@lucide/svelte/icons/phone"
  import Search from "@lucide/svelte/icons/search"
  import ToggleRight from "@lucide/svelte/icons/toggle-right"
  import Volume2 from "@lucide/svelte/icons/volume-2"
  import type { ExtensionGrant } from "./extension.ts"

  let { grants }: { grants: ExtensionGrant[] } = $props()

  const ICONS = {
    wallpaper: Image,
    "quick-settings": ToggleRight,
    taskbar: PanelBottom,
    search: Search,
    notifications: Bell,
    weather: CloudSun,
    location: MapPin,
    media: Music,
    popups: PanelTop,
    typing: Keyboard,
    sounds: Volume2,
    "audio-levels": AudioLines,
    calls: Phone,
    "locked-sounds": Lock,
    "do-not-disturb": BellOff,
    network: Globe,
    helper: Cpu,
  }
</script>

<section aria-labelledby="extension-permissions">
  <h2 id="extension-permissions" class="font-semibold">What it can do</h2>
  <ul class="mt-3 space-y-2.5 text-[15px] text-ink-soft">
    {#each grants as grant (grant.key)}
      {@const Icon = ICONS[grant.key]}
      <li class="flex gap-3">
        <Icon class="mt-0.5 size-[18px] shrink-0 {grant.key === 'helper' ? 'text-caution' : 'text-ink-muted'}" />
        <span class={grant.key === "helper" ? "font-medium text-ink" : ""}>{grant.label}</span>
      </li>
    {:else}
      <li class="text-ink-muted">Nothing beyond showing itself on Luft's desktop.</li>
    {/each}
  </ul>
</section>

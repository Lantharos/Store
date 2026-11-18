const SCRIPT = `(() => {
  const origin = new URL(document.currentScript.src).origin
  const names = { windows: "Windows", macos: "macOS", linux: "Linux", android: "Android" }
  const order = {
    windows: ["windows-x86_64", "windows-aarch64", "any"],
    macos: ["macos-universal", "macos-aarch64", "macos-x86_64", "any"],
    linux: ["linux-x86_64", "linux-aarch64", "any"],
    android: ["android", "any"],
  }
  const kinds = ["exe", "msi", "dmg", "pkg", "app-image", "appimage", "deb", "rpm", "flatpak", "apk", "zip", "tarball", "archive", "binary"]
  const agent = navigator.userAgent
  const os = /Android/.test(agent) ? "android" : /Windows/.test(agent) ? "windows" : /Mac OS X|Macintosh/.test(agent) ? "macos" : /Linux|X11/.test(agent) ? "linux" : null
  const arch = (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues
    ? navigator.userAgentData.getHighEntropyValues(["architecture"]).then((values) => values.architecture)
    : Promise.resolve(/arm64|aarch64/i.test(agent) ? "arm" : "x86")).catch(() => "x86")
  const megabytes = (size) => (size / 1e6 < 10 ? (size / 1e6).toFixed(1) : Math.round(size / 1e6)) + " MB"
  function pick(files, targets) {
    for (const target of targets) {
      const found = files.filter((file) => file.platform === target).sort((a, b) => kinds.indexOf(a.kind) - kinds.indexOf(b.kind))[0]
      if (found) return found
    }
  }
  for (const link of document.querySelectorAll("a[data-schelf]")) {
    if (link.dataset.schelfReady) continue
    link.dataset.schelfReady = "1"
    Promise.all([fetch(origin + "/" + link.dataset.schelf + "/latest.json").then((response) => response.json()), arch]).then(([project, cpu]) => {
      if (!os) return
      const arm = order[os].filter((target) => target.endsWith("aarch64"))
      const targets = cpu === "arm" ? [...arm, ...order[os].filter((target) => !arm.includes(target))] : order[os]
      const file = pick(project.files, targets)
      if (!file) return
      link.href = file.link
      link.textContent = "Download for " + names[os]
      link.title = project.name + " " + file.version + ", " + megabytes(file.size)
    })
  }
})()
`

export function embedScript() {
  return new Response(SCRIPT, {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "public, max-age=3600",
      "access-control-allow-origin": "*",
    },
  })
}

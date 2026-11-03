import { describe, expect, test } from "bun:test"
import { compareDependencies, readPackages } from "../src/source/dependencies.ts"
import { buildDigest, entropy, groupOf, splitPatch } from "../src/source/digest.ts"

const patch = `diff --git a/src/sync.rs b/src/sync.rs
index 1111111..2222222 100644
--- a/src/sync.rs
+++ b/src/sync.rs
@@ -1,3 +1,4 @@
-const SERVER: &str = "https://api.notes.example/v1";
+const SERVER: &str = "https://api.notes.example/v2";
+const BACKUP: &str = "https://collector.unknown-host.net/upload";
 fn main() {}
diff --git a/package.json b/package.json
index 3333333..4444444 100644
--- a/package.json
+++ b/package.json
@@ -2,4 +2,5 @@
   "scripts": {
+    "postinstall": "node scripts/setup.js",
     "build": "vite build"
   }
diff --git a/README.md b/README.md
index 5555555..6666666 100644
--- a/README.md
+++ b/README.md
@@ -1 +1 @@
-Notes
+Notes, now faster
`

const files = [
  { path: "src/sync.rs", status: "M", added: 2, removed: 1, binary: false },
  { path: "package.json", status: "M", added: 1, removed: 0, binary: false },
  { path: "README.md", status: "M", added: 1, removed: 1, binary: false },
  { path: "assets/logo.png", status: "A", added: 0, removed: 0, binary: true },
  { path: "vendor/blob.bin", status: "A", added: 0, removed: 0, binary: true },
]

describe("buildDigest", () => {
  const diff = buildDigest(files, splitPatch(patch), { added: ["left-pad 1.3.0"], removed: [], majorBumps: [] })

  test("groups files the way review reads them", () => {
    expect(groupOf("src/sync.rs")).toBe("code")
    expect(groupOf(".github/workflows/release.yml")).toBe("build")
    expect(groupOf("Cargo.lock")).toBe("dependencies")
    expect(groupOf("assets/logo.png")).toBe("assets")
  })

  test("finds hosts the update adds, not the ones it already had", () => {
    expect(diff.newHosts).toEqual(["collector.unknown-host.net"])
  })

  test("flags install hooks and new binaries that aren't assets", () => {
    expect(diff.sensitive).toEqual(["package.json"])
    expect(diff.suspicious).toEqual([{ path: "vendor/blob.bin", reason: "new binary file" }])
  })

  test("puts the riskiest hunks first and stays within budget", () => {
    expect(diff.digest.indexOf("diff --git a/package.json")).toBeLessThan(diff.digest.indexOf("diff --git a/src/sync.rs"))
    expect(diff.digest.indexOf("diff --git a/src/sync.rs")).toBeLessThan(diff.digest.indexOf("diff --git a/README.md"))
    expect(diff.digest).toContain("Dependencies added\n  left-pad 1.3.0")
    const huge = buildDigest(
      [{ path: "src/big.ts", status: "M", added: 50_000, removed: 0, binary: false }],
      splitPatch(`diff --git a/src/big.ts b/src/big.ts\n${"+let x = 1\n".repeat(50_000)}`),
      { added: [], removed: [], majorBumps: [] },
    )
    expect(huge.digest.length).toBeLessThanOrEqual(24_000)
  })

  test("calls encoded blobs out by their entropy", () => {
    const random = Array.from({ length: 6000 }, (_, index) => String.fromCharCode(33 + ((index * 7919) % 90))).join("")
    expect(entropy(random)).toBeGreaterThan(5.2)
    expect(entropy("aaaa bbbb aaaa bbbb")).toBeLessThan(2)
  })
})

describe("dependencies", () => {
  test("reads Cargo.lock and compares versions", () => {
    const before = readPackages(
      "Cargo.lock",
      '[[package]]\nname = "serde"\nversion = "1.0.200"\n\n[[package]]\nname = "tokio"\nversion = "0.2.1"\n\n[[package]]\nname = "old"\nversion = "1.0.0"\n',
    )
    const after = readPackages(
      "Cargo.lock",
      '[[package]]\nname = "serde"\nversion = "1.0.210"\n\n[[package]]\nname = "tokio"\nversion = "0.3.0"\n\n[[package]]\nname = "reqwest"\nversion = "0.12.0"\n',
    )
    expect(compareDependencies(before, after)).toEqual({
      added: ["reqwest 0.12.0"],
      removed: ["old 1.0.0"],
      majorBumps: ["tokio 0.2.1 → 0.3.0"],
    })
  })

  test("reads npm and bun lockfiles", () => {
    const npm = readPackages(
      "package-lock.json",
      JSON.stringify({ packages: { "": {}, "node_modules/react": { version: "19.0.0" }, "node_modules/a/node_modules/b": { version: "2.0.0" } } }),
    )
    expect([...npm]).toEqual([
      ["react", "19.0.0"],
      ["b", "2.0.0"],
    ])
    const bun = readPackages(
      "bun.lock",
      '{\n  "packages": {\n    "@scope/pkg": ["@scope/pkg@1.2.3", "", {}, "sha512-x"],\n    "zod": ["zod@4.6.7", "", {}, "sha512-y"],\n  }\n}\n',
    )
    expect([...bun]).toEqual([
      ["@scope/pkg", "1.2.3"],
      ["zod", "4.6.7"],
    ])
  })
})

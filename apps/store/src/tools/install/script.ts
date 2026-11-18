import type { ToolFile } from "@schelf/protocol"

export const POSIX_TARGETS = ["linux-x86_64", "linux-aarch64", "macos-aarch64", "macos-x86_64"] as const
export type PosixTarget = (typeof POSIX_TARGETS)[number]

export interface Bootstrap {
  version: string
  files: Partial<Record<PosixTarget, ToolFile>>
  then: { tool: string; publisher: string; verified: boolean } | null
}

const SAFE = /^[A-Za-z0-9._~:/%+-]*$/

function word(value: string) {
  if (!SAFE.test(value)) throw new Error(`${value} can't go into the install script`)
  return value
}

const quoted = (value: string) => `'${word(value)}'`

const literal = (text: string) => `'${text.replaceAll("'", `'\\''`)}'`

function fileCases(files: Bootstrap["files"]) {
  return Object.entries(files)
    .map(
      ([target, file]) =>
        `    ${target}) set -- ${quoted(file.url)} ${quoted(file.sha256)} ${quoted(file.kind)} ${file.size} ;;`,
    )
    .join("\n")
}

function followUp(then: Bootstrap["then"]) {
  if (!then) return ""
  const trust = then.verified ? "a verified publisher" : "a publisher Schelf hasn't verified"
  const tool = word(then.tool)
  return `
  say ""
  say ${literal(`${tool} is published by ${then.publisher}, ${trust}. It runs with everything you can do.`)}
  say "Running schelf add ${tool}"
  if (exec </dev/tty) 2>/dev/null; then
    "$bin/schelf" add ${quoted(then.tool)} </dev/tty
  else
    "$bin/schelf" add ${quoted(then.tool)}
  fi`
}

export function installScript(bootstrap: Bootstrap) {
  const version = word(bootstrap.version)
  return `#!/bin/sh
set -eu

say() { printf '%s\\n' "$*"; }
fail() { printf 'schelf: %s\\n' "$*" >&2; exit 1; }

target() {
  case "$(uname -s)" in
    Linux) os=linux ;;
    Darwin) os=macos ;;
    *) fail "this installs schelf on Linux and macOS; $(uname -s) isn't one of them" ;;
  esac
  case "$(uname -m)" in
    x86_64 | amd64) arch=x86_64 ;;
    aarch64 | arm64) arch=aarch64 ;;
    *) fail "schelf isn't built for $(uname -m)" ;;
  esac
  if [ "$os" = macos ] && [ "$(sysctl -n sysctl.proc_translated 2>/dev/null || echo 0)" = 1 ]; then
    arch=aarch64
  fi
  say "$os-$arch"
}

pick() {
  case "$1" in
${fileCases(bootstrap.files)}
    *) return 1 ;;
  esac
  printf '%s %s %s %s\\n' "$1" "$2" "$3" "$4"
}

fetch() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --proto '=https' --tlsv1.2 -o "$2" "$1"
  elif command -v wget >/dev/null 2>&1; then
    wget -q --https-only -O "$2" "$1"
  else
    fail "this needs curl or wget"
  fi
}

digest() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d ' ' -f 1
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | cut -d ' ' -f 1
  elif command -v openssl >/dev/null 2>&1; then
    openssl dgst -sha256 -r "$1" | cut -d ' ' -f 1
  else
    fail "this needs sha256sum, shasum or openssl to check the download"
  fi
}

unpack() {
  mkdir "$work/out"
  case "$1" in
    binary) cp "$2" "$work/out/schelf" ;;
    tarball) tar -xf "$2" -C "$work/out" ;;
    zip) command -v unzip >/dev/null 2>&1 || fail "this needs unzip"; unzip -q "$2" -d "$work/out" ;;
    *) fail "schelf came as a $1, which this can't install" ;;
  esac
  found=$(find "$work/out" -type f)
  [ "$(printf '%s\\n' "$found" | wc -l)" -eq 1 ] || fail "the download holds more than the schelf program"
  printf '%s\\n' "$found"
}

path_hint() {
  case ":$PATH:" in *":$bin:"*) return ;; esac
  say ""
  say "$bin isn't on your PATH yet. Add it with:"
  case "$(basename "\${SHELL:-sh}")" in
    fish) say "  fish_add_path $bin" ;;
    zsh) say "  echo 'export PATH=\\"$bin:\\$PATH\\"' >> ~/.zshrc" ;;
    bash) say "  echo 'export PATH=\\"$bin:\\$PATH\\"' >> ~/.bashrc" ;;
    *) say "  echo 'export PATH=\\"$bin:\\$PATH\\"' >> ~/.profile" ;;
  esac
  say "and open a new terminal."
}

main() {
  platform=$(target)
  entry=$(pick "$platform") || fail "schelf ${version} has no build for $platform yet"
  set -- $entry
  url=$1 sha=$2 kind=$3 size=$4
  bin=\${SCHELF_BIN:-$HOME/.local/bin}
  work=$(mktemp -d)
  trap 'rm -rf "$work"' EXIT INT TERM

  say "Downloading schelf ${version} for $platform"
  fetch "$url" "$work/download"
  [ "$(wc -c < "$work/download" | tr -d ' ')" = "$size" ] || fail "the download is the wrong size; try again"
  [ "$(digest "$work/download")" = "$sha" ] || fail "the download doesn't match the SHA-256 schelf.store published for it"
  say "Its SHA-256 matches the one schelf.store published for it"

  program=$(unpack "$kind" "$work/download")
  mkdir -p "$bin"
  cp "$program" "$bin/.schelf.$$"
  chmod 755 "$bin/.schelf.$$"
  mv -f "$bin/.schelf.$$" "$bin/schelf"
  if [ ! -e "$bin/sch" ] || [ -L "$bin/sch" ]; then ln -sf schelf "$bin/sch"; fi
  say "Installed schelf in $bin"
  path_hint${followUp(bootstrap.then)}
}

main "$@"
`
}

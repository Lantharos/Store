import { basename, join } from "node:path"
import { readOptional } from "../project/files.ts"

export async function helperBuild(root: string, path: string) {
  const program = basename(path)
  if (await readOptional(join(root, "Cargo.toml")))
    return `cargo build --release --bin ${program} && cp target/release/${program} ${path}`
  if (await readOptional(join(root, "meson.build")))
    return `sudo apt-get install -y meson ninja-build && meson setup build && meson compile -C build ${program} && cp build/${program} ${path}`
  return `make ${path}`
}

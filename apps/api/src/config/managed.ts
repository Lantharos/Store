import { fail } from "../lib/http.ts"
import type { AppRow } from "../signing/records.ts"

export function refuseIfListingInFiles(app: AppRow) {
  const file = app.configFiles?.listing_toml
  if (file) fail(409, `The listing is set in ${file}; change it there and run schelf apply`)
}

export function refuseIfSetInFiles(app: AppRow) {
  const file = app.configFiles?.schelf_toml
  if (file) fail(409, `This is set in ${file}; change it there and run schelf apply`)
}

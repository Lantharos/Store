import { expect, test } from "bun:test"
import { flag, parseArgs } from "../src/args.ts"
import { rolloutRequest } from "../src/commands/rollout.ts"

test("flags take values only where a value is expected", () => {
  const args = parseArgs([
    "publish",
    "--version",
    "1.0.0",
    "--verbose",
    "dist/a",
    "--api=http://localhost:8787",
    "dist/b",
  ])
  expect(args.positionals).toEqual(["publish", "dist/a", "dist/b"])
  expect(flag(args, "version")).toBe("1.0.0")
  expect(flag(args, "api")).toBe("http://localhost:8787")
  expect(args.flags.get("verbose")).toBe(true)
})

test("rollout changes", () => {
  expect(rolloutRequest("25")).toEqual({ action: "set", percent: 25 })
  expect(rolloutRequest("50%")).toEqual({ action: "set", percent: 50 })
  expect(rolloutRequest("100")).toEqual({ action: "all" })
  expect(rolloutRequest("pause")).toEqual({ action: "pause" })
  expect(() => rolloutRequest("0")).toThrow()
  expect(() => rolloutRequest("faster")).toThrow()
})

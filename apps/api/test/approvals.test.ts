import { env, exports } from "cloudflare:workers"
import type { Approval } from "@schelf/protocol"
import { describe, expect, test } from "vitest"
import { json, person, publisherWithApp } from "./fixtures.ts"

describe("approving in the browser", () => {
  test("the command can't delete a project itself, and a request runs only once its owner approves in the browser", async () => {
    const { appId, userId } = await publisherWithApp()
    await env.DB.prepare("UPDATE app SET visibility = 'unlisted' WHERE id = ?").bind(appId).run()
    const command = await person("Mira", userId, "cli")
    expect((await command.call("DELETE", `/apps/${appId}`)).status).toBe(403)

    const request = await json<Approval>(
      await command.call("POST", "/requests", {
        actions: [{ type: "listing.request", app: appId }],
        host: "laptop",
      }),
    )
    expect(request).toMatchObject({ status: "pending", passkey: false, host: "laptop" })
    expect(request.steps[0]!.summary).toContain("Ask a reviewer to list")
    expect((await command.call("POST", `/requests/${request.id}/approve`)).status).toBe(403)

    const stranger = await person("Someone")
    expect((await stranger.call("POST", `/requests/${request.id}/approve`)).status).toBe(404)

    const browser = await person("Mira", userId, "browser")
    const decided = await json<Approval>(await browser.call("POST", `/requests/${request.id}/approve`))
    expect(decided.status).toBe("failed")
    expect(decided.steps[0]).toMatchObject({
      outcome: "failed",
      detail: expect.stringContaining("Publish a release first"),
    })
    expect((await browser.call("POST", `/requests/${request.id}/approve`)).status).toBe(409)
  })

  test("changing who may publish needs a passkey confirmed in the last few minutes", async () => {
    const { appId, userId } = await publisherWithApp()
    const command = await person("Mira", userId, "cli")
    const request = await json<Approval>(
      await command.call("POST", "/requests", {
        actions: [{ type: "trust.remove", app: appId, rule: "none" }],
      }),
    )
    expect(request.passkey).toBe(true)
    const browser = await person("Mira", userId, "browser")
    expect((await browser.call("POST", `/requests/${request.id}/approve`)).status).toBe(403)
    const passkey = await person("Mira", userId, "passkey")
    expect((await json<Approval>(await passkey.call("POST", `/requests/${request.id}/approve`))).status).toBe(
      "done",
    )
  })

  test("a cancelled request can't be approved", async () => {
    const { appId, userId } = await publisherWithApp()
    const command = await person("Mira", userId, "cli")
    const request = await json<Approval>(
      await command.call("POST", "/requests", { actions: [{ type: "project.delete", app: appId }] }),
    )
    await json(await command.call("POST", `/requests/${request.id}/cancel`))
    const passkey = await person("Mira", userId, "passkey")
    expect((await passkey.call("POST", `/requests/${request.id}/approve`)).status).toBe(409)
  })

  test("the command can't change the account behind it", async () => {
    const { userId } = await publisherWithApp()
    const command = await person("Mira", userId, "cli")
    const response = await exports.default.fetch(
      new Request("https://schelf.store/api/auth/delete-user", {
        method: "POST",
        headers: { authorization: `Bearer ${command.token}`, "content-type": "application/json" },
        body: "{}",
      }),
    )
    expect(response.status).toBe(403)
  })
})

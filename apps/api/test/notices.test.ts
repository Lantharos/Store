import { env } from "cloudflare:workers"
import { describe, expect, test, vi } from "vitest"
import { db, schema } from "../src/db/client.ts"
import { randomId } from "../src/lib/ids.ts"
import { compose } from "../src/mail/notices/send.ts"
import { signInCode } from "../src/mail/notices/templates/codes.ts"
import { invite } from "../src/mail/notices/templates/invite.ts"
import { type ReleaseData, releaseMail } from "../src/mail/notices/templates/releases.ts"
import { stepRollouts } from "../src/releases/rollout.ts"
import { publisherWithApp } from "./fixtures.ts"

const release: ReleaseData = {
  appId: "com.example.Notes",
  releaseId: "r1",
  name: "Notes",
  version: "2.0.0",
  icon: "https://dl.schelf.store/media/com.example.Notes/abc.png",
  publisher: "Mira",
  rolloutPercent: 10,
}

describe("notices", () => {
  test("go out as Schelf with an HTML and a plain-text part", () => {
    const message = compose(
      "someone@example.com",
      signInCode({ email: "someone@example.com", otp: "123456", minutes: 10 }),
    )
    expect(message.from).toEqual({ name: "Schelf", email: env.NOTIFY_FROM })
    expect(message.subject).toBe("123456 is your Schelf sign-in code")
    expect(message.replyTo).toBeUndefined()
    expect(message.html).toMatch(/^<!doctype html>/)
    expect(message.html).toContain(">123456</td>")
    expect(message.text).toContain("\n\n123456\n\n")
    expect(message.text).not.toContain("<")
  })

  test("escape what people wrote in the HTML and keep it as written in the text", () => {
    const note = 'Remove the <script> tag & the "beta" label.\nThen send it again.'
    const message = compose(
      "mira@example.com",
      releaseMail("changes-requested", { ...release, message: note }),
    )
    expect(message.html).toContain(
      "Remove the &lt;script&gt; tag &amp; the &quot;beta&quot; label.<br>Then send it again.",
    )
    expect(message.html).not.toContain("<script>")
    expect(message.text).toContain('> Remove the <script> tag & the "beta" label.\n> Then send it again.')
    expect(message.replyTo).toEqual({ name: "Schelf Support", email: "support@schelf.store" })
  })

  test("link to the release and show the app's icon as a picture mail clients can draw", () => {
    const raster = compose("mira@example.com", releaseMail("approved", release))
    expect(raster.html).toContain(`src="${release.icon}"`)
    expect(raster.html).toContain(`${env.PUBLIC_URL}/dashboard/apps/com.example.Notes/releases/r1`)
    expect(raster.text).toContain("It starts with 10% of devices")
    const vector = compose(
      "mira@example.com",
      releaseMail("approved", { ...release, icon: "https://dl.schelf.store/x.svg", rolloutPercent: 100 }),
    )
    expect(vector.html).toContain(`src="https://dl.schelf.store/x.png"`)
    expect(vector.text).toContain("every device with Notes is offered it now")
  })

  test("invitations name the organisation and the inviter, and replies reach the inviter", () => {
    const inviter = { name: "Mira Koch", email: "mira@example.com" }
    const mail = invite({
      inviter,
      publisher: "Kaleidal",
      role: "Admin",
      githubLogin: null,
      expires: new Date("2026-11-17"),
    })
    expect(mail.subject).toBe("Mira Koch invited you to Kaleidal on Schelf")
    expect(mail.replyTo).toEqual(inviter)
    expect(compose("new@example.com", mail).text).toContain("as an admin")
  })

  test("members hear when a rollout reaches everyone", async () => {
    const send = vi.spyOn(env.EMAIL, "send").mockResolvedValue({ messageId: "sent" })
    const { appId } = await publisherWithApp()
    const id = randomId()
    const start = new Date("2026-11-01T00:00:00Z")
    await db.insert(schema.release).values({
      id,
      appId,
      version: "3.1.0",
      origin: "manual",
      format: "appimage",
      manifest: "",
      requires: {},
      status: "rolling-out",
      rolloutPercent: 50,
      rolloutSteppedAt: start,
      approvedAt: start,
    })
    await stepRollouts(new Date(start.getTime() + 24 * 3_600_000))
    const live = () =>
      send.mock.calls
        .map(([message]) => message as EmailMessageBuilder)
        .find((message) => message.subject.endsWith("3.1.0 is out to everyone"))
    await vi.waitFor(() => expect(live()).toBeDefined())
    expect(live()!.to).toMatch(/^mira-\w+@example\.com$/)
    send.mockRestore()
  })
})

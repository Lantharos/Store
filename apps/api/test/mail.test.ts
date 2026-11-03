import { env } from "cloudflare:workers"
import { eq } from "drizzle-orm"
import { describe, expect, test } from "vitest"
import { db, schema } from "../src/db/client.ts"
import { randomId } from "../src/lib/ids.ts"
import { recipientOf } from "../src/mail/addresses.ts"
import { readMail } from "../src/mail/parse.ts"
import { receiveMail } from "../src/mail/receive.ts"
import { isAutomated, verdictOf } from "../src/mail/screen.ts"
import { threadingHeaders, threadOfReferences } from "../src/mail/threads.ts"

const ALIGNED =
  "Authentication-Results: mx.cloudflare.net; spf=pass smtp.mailfrom=example.org; dkim=pass header.d=example.org; dmarc=pass header.from=example.org"

function raw(headers: string[], body = "Hello there.") {
  return [
    ALIGNED,
    "From: Mira Halvorsen <mira@example.org>",
    "To: legal@schelf.store",
    "Subject: Notice about an app",
    `Message-ID: <${randomId()}@example.org>`,
    ...headers,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ].join("\r\n")
}

const bytes = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer

function incoming(to: string, text: string, from = `${randomId()}@example.org`) {
  const rejected: string[] = []
  const message = {
    from,
    to,
    raw: new Response(text).body!,
    rawSize: text.length,
    headers: new Headers(),
    setReject: (reason: string) => rejected.push(reason),
  } as unknown as ForwardableEmailMessage
  return { message, rejected }
}

const stored = (messageId: string) => db.query.mail.findFirst({ where: eq(schema.mail.messageId, messageId) })

describe("reading mail", () => {
  test("keeps the text, real attachments and the conversation it answers", async () => {
    const mail = await readMail(
      bytes(
        [
          "From: Mira <MIRA@example.org>",
          "Subject: Re: Your notice",
          "Message-ID: <three@example.org>",
          "In-Reply-To: <two@schelf.store>",
          "References: <one@example.org> <two@schelf.store>",
          'Content-Type: multipart/mixed; boundary="outer"',
          "",
          "--outer",
          'Content-Type: multipart/related; boundary="inner"',
          "",
          "--inner",
          "Content-Type: text/html; charset=utf-8",
          "",
          '<p>First&nbsp;line</p><p>Second &amp; last</p><img src="cid:logo">',
          "--inner",
          "Content-Type: image/png",
          "Content-ID: <logo>",
          "Content-Disposition: inline",
          "Content-Transfer-Encoding: base64",
          "",
          "iVBORw0KGgo=",
          "--inner--",
          "--outer",
          'Content-Type: application/pdf; name="notice.pdf"',
          'Content-Disposition: attachment; filename="notice.pdf"',
          "Content-Transfer-Encoding: base64",
          "",
          "JVBERi0xLjQ=",
          "--outer--",
        ].join("\r\n"),
      ),
    )
    expect(mail.from).toBe("mira@example.org")
    expect(mail.messageId).toBe("three@example.org")
    expect(mail.text).toBe("First line\nSecond & last")
    expect(mail.references).toEqual(["two@schelf.store", "one@example.org"])
    expect(mail.files.map((file) => [file.name, file.contentType])).toEqual([
      ["notice.pdf", "application/pdf"],
    ])
  })

  test("a thread rides on the address after the plus", () => {
    expect(recipientOf("Legal+abc123@Schelf.Store")).toEqual({ name: "legal", thread: "abc123" })
    expect(recipientOf("legal@schelf.store")).toEqual({ name: "legal", thread: null })
    expect(recipientOf("legal@elsewhere.org")).toBeNull()
  })
})

describe("screening mail", () => {
  const headers = (...lines: [string, string][]) =>
    lines.map(([key, value]) => ({ key, originalKey: key, value }))

  test("trusts only the routing server's own results", () => {
    const forged = ["authentication-results", "mx.example.org; spf=pass; dkim=pass; dmarc=pass"] as [
      string,
      string,
    ]
    expect(verdictOf(headers(["authentication-results", "mx.cloudflare.net; spf=pass; dmarc=pass"]))).toBe(
      "aligned",
    )
    expect(
      verdictOf(headers(["authentication-results", "mx.cloudflare.net; spf=pass; dmarc=fail"], forged)),
    ).toBe("reject")
    expect(
      verdictOf(headers(["authentication-results", "mx.cloudflare.net; spf=none; dkim=pass; dmarc=none"])),
    ).toBe("verified")
    expect(
      verdictOf(headers(["authentication-results", "mx.cloudflare.net; spf=fail; dkim=none"], forged)),
    ).toBe("quarantine")
    expect(verdictOf(headers(forged))).toBe("unverified")
  })

  test("recognises bulk and machine mail", () => {
    expect(isAutomated(headers(["auto-submitted", "auto-replied"]), "mira@example.org")).toBe(true)
    expect(isAutomated(headers(["auto-submitted", "no"]), "mira@example.org")).toBe(false)
    expect(isAutomated(headers(["list-id", "<news.example.org>"]), "mira@example.org")).toBe(true)
    expect(isAutomated(headers(["precedence", "bulk"]), "mira@example.org")).toBe(true)
    expect(isAutomated([], "mailer-daemon@example.org")).toBe(true)
    expect(isAutomated([], "mira@example.org")).toBe(false)
  })
})

describe("receiving mail", () => {
  test("refuses addresses nobody reads", async () => {
    const { message, rejected } = incoming("ceo@schelf.store", raw([]))
    await receiveMail(message)
    expect(rejected).toHaveLength(1)
    const noReply = incoming(env.NOTIFY_FROM, raw([]))
    await receiveMail(noReply.message)
    expect(noReply.rejected[0]).toContain("support@schelf.store")
  })

  test("refuses mail that fails DMARC", async () => {
    const text = raw([]).replace("dmarc=pass", "dmarc=fail")
    const { message, rejected } = incoming("legal@schelf.store", text)
    await receiveMail(message)
    expect(rejected).toHaveLength(1)
  })

  test("a legal notice from a real sender is kept and gets a receipt", async () => {
    const id = `${randomId()}@example.org`
    const text = raw([]).replace(/Message-ID: <[^>]+>/, `Message-ID: <${id}>`)
    await receiveMail(incoming("legal@schelf.store", text).message)
    const row = await stored(id)
    expect(row).toMatchObject({ mailbox: "legal", thread: null, tags: [], acknowledge: true })
    expect(await env.BUCKET.head(row!.rawKey!)).not.toBeNull()
  })

  test("bulk mail is kept without a receipt", async () => {
    const id = `${randomId()}@example.org`
    const text = raw(["List-Id: <news.example.org>"]).replace(/Message-ID: <[^>]+>/, `Message-ID: <${id}>`)
    await receiveMail(incoming("legal@schelf.store", text).message)
    expect(await stored(id)).toMatchObject({ tags: ["automated"], acknowledge: false })
  })

  test("a reply finds its conversation by the plus address or by the messages it answers", async () => {
    const item = randomId()
    const ours = `${randomId()}@schelf.store`
    await db
      .insert(schema.mail)
      .values({ id: randomId(), direction: "out", mailbox: "support", messageId: ours, pultItem: item })

    const byHeader = `${randomId()}@example.org`
    await receiveMail(
      incoming(
        "support@schelf.store",
        raw([`In-Reply-To: <${ours}>`]).replace(/Message-ID: <[^>]+>/, `Message-ID: <${byHeader}>`),
      ).message,
    )
    expect(await stored(byHeader)).toMatchObject({ thread: item, acknowledge: false })

    const byAddress = `${randomId()}@example.org`
    await receiveMail(
      incoming(
        `support+${item}@schelf.store`,
        raw([]).replace(/Message-ID: <[^>]+>/, `Message-ID: <${byAddress}>`),
      ).message,
    )
    expect(await stored(byAddress)).toMatchObject({ thread: item })
  })

  test("too many messages from one sender are turned away", async () => {
    const sender = `${randomId()}@example.org`
    const outcomes = []
    for (let index = 0; index < 11; index++) {
      const { message, rejected } = incoming("hello@schelf.store", raw([]), sender)
      await receiveMail(message)
      outcomes.push(rejected.length)
    }
    expect(outcomes.at(-1)).toBe(1)
  })
})

describe("replying", () => {
  test("answers the latest message and carries the conversation", async () => {
    const item = randomId()
    const rows = [
      { direction: "in", messageId: "first@example.org", at: 1 },
      { direction: "out", messageId: "reply@schelf.store", at: 2 },
      { direction: "in", messageId: "second@example.org", at: 3 },
    ] as const
    await db.insert(schema.mail).values(
      rows.map((row) => ({
        id: randomId(),
        direction: row.direction,
        mailbox: "legal",
        messageId: row.messageId,
        pultItem: item,
        createdAt: new Date(row.at),
      })),
    )
    expect(await threadingHeaders(item)).toEqual({
      "In-Reply-To": "<second@example.org>",
      References: "<first@example.org> <reply@schelf.store> <second@example.org>",
    })
    expect(await threadOfReferences(["unknown@example.org", "reply@schelf.store"])).toBe(item)
  })
})

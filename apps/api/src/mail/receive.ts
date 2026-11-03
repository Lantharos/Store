import { env } from "cloudflare:workers"
import { db, schema } from "../db/client.ts"
import { randomId } from "../lib/ids.ts"
import { backOffice, publishDefinitions } from "../ops/pult.ts"
import { ACKNOWLEDGED, addressOf, isMailbox, recipientOf } from "./addresses.ts"
import { deliverMail } from "./deliver.ts"
import { readMail } from "./parse.ts"
import { isAutomated, verdictOf } from "./screen.ts"
import { quarantinedKey, storedKey, storeRaw } from "./stored.ts"
import { threadOfReferences, threadOfToken } from "./threads.ts"

const NOTIFICATIONS = recipientOf(env.NOTIFY_FROM)?.name

export async function receiveMail(message: ForwardableEmailMessage) {
  const recipient = recipientOf(message.to)
  if (recipient?.name === NOTIFICATIONS)
    return message.setReject(`This address doesn't take mail. Write to ${addressOf("support")} instead.`)
  if (!recipient || !isMailbox(recipient.name)) return message.setReject("There's no one at this address.")
  const { success } = await env.MAIL_LIMIT.limit({ key: message.from.toLowerCase() })
  if (!success) return message.setReject("Too many messages from this address. Try again in a minute.")

  const raw = await new Response(message.raw).arrayBuffer()
  const mail = await readMail(raw)
  const verdict = verdictOf(mail.headers)
  if (verdict === "reject") return message.setReject("This message failed its sender's DMARC policy.")
  const id = randomId()
  if (verdict === "quarantine") {
    await storeRaw(quarantinedKey(id), raw)
    console.warn(`Quarantined mail to ${recipient.name} from ${message.from}: SPF failed`)
    return
  }

  const automated = isAutomated(mail.headers, mail.from || message.from.toLowerCase())
  const rawKey = storedKey(id)
  await storeRaw(rawKey, raw)
  const [row] = await db
    .insert(schema.mail)
    .values({
      id,
      direction: "in",
      mailbox: recipient.name,
      messageId: mail.messageId,
      rawKey,
      thread: recipient.thread
        ? await threadOfToken(recipient.thread)
        : await threadOfReferences(mail.references),
      tags: [...(automated ? ["automated"] : []), ...(verdict === "unverified" ? ["unverified"] : [])],
      acknowledge: ACKNOWLEDGED.includes(recipient.name) && verdict === "aligned" && !automated,
    })
    .returning()

  const office = backOffice()
  if (!office) return
  try {
    await publishDefinitions()
    await deliverMail(office.pult, row!, { raw, mail })
  } catch (error) {
    console.error(`Mail ${id} waits for the next delivery`, error)
  }
}

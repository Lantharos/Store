import { recheckNamespaces } from "./dashboard/account/namespaces.ts"
import { checkDomains } from "./domains/check.ts"
import { rollUpDownloads } from "./downloads/rollup.ts"
import { pruneChannels } from "./hosting/channels/channels.ts"
import { purgeDeleted } from "./hosting/deletion.ts"
import { receiveMail } from "./mail/receive.ts"
import { deliverPending } from "./ops/pending.ts"
import { backOffice, publishDefinitions } from "./ops/pult.ts"
import { restartStalledChecks } from "./releases/checks.ts"
import { stepRollouts } from "./releases/rollout.ts"
import { serve } from "./serve.ts"
import { resignEverything, resignIfRequested, type SigningJob, signQueued } from "./signing/queue.ts"
import { reindexIfRequested } from "./storefront/indexing.ts"

const HOURLY = "0 * * * *"

export default {
  fetch(request, _, context) {
    context.waitUntil(publishDefinitions())
    return serve(request, context)
  },
  async scheduled(controller) {
    if (controller.cron === HOURLY) {
      const office = backOffice()
      await Promise.all([
        stepRollouts(),
        restartStalledChecks(),
        checkDomains(),
        pruneChannels(),
        resignIfRequested(),
        reindexIfRequested(),
        publishDefinitions(),
        office && deliverPending(office.pult),
      ])
      return
    }
    await Promise.all([rollUpDownloads(), recheckNamespaces(), purgeDeleted(), resignEverything()])
  },
  queue: (batch) => signQueued(batch as MessageBatch<SigningJob>),
  email: receiveMail,
} satisfies ExportedHandler<Env, SigningJob>

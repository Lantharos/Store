import { maybeGithub } from "./api.ts"

interface AttestationList {
  attestations: { repository_id: number; bundle: { dsseEnvelope?: { payload: string } } }[]
}

interface Statement {
  subject: { name: string; digest: { sha256?: string } }[]
  predicate?: {
    buildDefinition?: {
      externalParameters?: { workflow?: { repository?: string; path?: string; ref?: string } }
    }
  }
}

export interface Attestation {
  url: string
  workflow: string | null
}

export async function findAttestation(
  repository: string,
  repositoryId: string,
  sha256: string,
  token?: string | null,
) {
  const found = await maybeGithub<AttestationList>(
    `/repos/${repository}/attestations/sha256:${sha256}?per_page=10`,
    { token },
  )
  for (const entry of found?.attestations ?? []) {
    if (String(entry.repository_id) !== repositoryId || !entry.bundle.dsseEnvelope) continue
    const statement = JSON.parse(atob(entry.bundle.dsseEnvelope.payload)) as Statement
    if (!statement.subject.some((subject) => subject.digest.sha256 === sha256)) continue
    const workflow = statement.predicate?.buildDefinition?.externalParameters?.workflow
    return {
      url: `https://api.github.com/repos/${repository}/attestations/sha256:${sha256}`,
      workflow: workflow?.path ?? null,
    } satisfies Attestation
  }
  return null
}

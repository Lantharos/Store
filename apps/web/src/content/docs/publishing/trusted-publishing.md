---

title: Trusted publishing
description: How Schelf knows a release really came from your repository, without any secrets to copy or leak.
---

A trusted publisher is a rule on your app: “releases of this app may come from the workflow `.github/workflows/schelf.yml` in the repository `alice/notes`”, optionally only from one GitHub environment. When that workflow runs, GitHub gives it a short-lived token that proves which repository, workflow and tag it is. Schelf checks that token against your rule. Nothing else can publish.

There are no keys to keep, rotate or lose, and nothing to paste into your repository's secrets.

## Setting one up

`schelf init` adds one for you. To add or change one by hand, open your app in the dashboard and go to **Publishing**. You need:

| Field       | Example                        |
| ----------- | ------------------------------ |
| Repository  | `alice/notes`                  |
| Workflow    | `.github/workflows/schelf.yml` |
| Environment | `release`, or leave it empty   |

Schelf stores GitHub's numeric ids for the repository and its owner next to the names, so if the repository is deleted and someone re-creates one with the same name, it can't publish.

## What the workflow needs

The job that publishes needs permission to ask GitHub for the token and to record build attestations:

```yaml
permissions:
  contents: read
  id-token: write
  attestations: write
```

Releases are only accepted from tags, so a push to a branch can never publish.

## Using an environment

If you set an environment, only jobs that run in it can publish. Add required reviewers to the environment in your repository's settings and every release needs a click from one of them before it leaves GitHub, on top of Schelf's own review.

## Publishing from somewhere else

For other CI or your own computer, create a token in **Publishing** and use [`schelf publish`](/docs/cli). A token is scoped to one app, shown once, expires after a year and can be revoked at any time. Releases sent with a token are marked “uploaded by the developer” instead of “built on GitHub”, and reviewers see the difference.

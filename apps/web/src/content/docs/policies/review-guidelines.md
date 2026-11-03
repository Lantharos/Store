---

title: Review guidelines
description: What review looks at, and what gets a release sent back.
---

Every new app and every update is looked at by a person before it reaches anyone. Automatic checks go first and only stop obvious problems, like a file that doesn't match its hash or a listing with no screenshots. A person makes every other decision, including every rejection and every removal.

These are examples, not a contract. If you're unsure about something, [ask us](/legal/contact) before you build it.

## What review looks at

- **What it does matches what it says.** The description, screenshots and permissions describe the app people will get.
- **Permissions it uses.** Reviewers see what your binary can actually do next to what you declared. Ask for what you use and nothing more.
- **The change since last time.** For open-source apps, reviewers read the source diff since your last approved release.
- **Where it was built.** Every file is traced to the workflow run that built it.
- **The licence.** Apps are open source at launch: an OSI-approved or FSF-free licence, and bundled code whose licences allow it.

## What gets sent back

- **Malware, and anything sneaky.** Mining, hidden data collection, backdoors, or code that downloads and runs something the reviewer couldn't see.
- **Collecting data without saying so.** If your app sends anything about the person anywhere, say what and where in the description and the privacy link. Crash reports and analytics need a clear way to say no.
- **Pretending to be someone else.** A name, icon or description that passes for another app or company. Forks are welcome under their own name.
- **Permissions it doesn't need.** Full access for an app that edits text files, or the network for an offline tool.
- **Spam and copycats.** Many near-identical apps, keyword-stuffed names, or a wrapper around a website with nothing added.
- **Illegal content**, or content that's unlawful where most people using it live.
- **Not working.** An app that doesn't start, or a listing that shows something it doesn't do.

“Request changes” tells you exactly what to fix, and the next release you publish picks up where this one left off. “Reject” is for releases that can't be fixed by a change, and always comes with a reason you can [appeal](/legal/contact) by replying to the email.

## Updates

Updates usually go through quickly. They take longer when they widen permissions, change the app's name or icon, or touch code that talks to the network or the file system in a new way.

## After you're live

If something is found later, we can stop a release or the whole app from starting on every device. That's for real harm, like malware or a compromised account, and you'll always get the reason. See [stopping a release](/docs/stopping-a-release).

# Legal

What a small, free, open-source-only store has to have in place on day one, and what can wait. This is a plan to take to a lawyer once, not legal advice.

## Who runs it

Until there is a company, the operator is the owner as a natural person, and that is the reason paid apps wait: selling needs a merchant of record, VAT handling and a company to carry liability.

## Documents

| Document                      | Who accepts it                                                       | What it says                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Developer agreement           | Every developer, on first submission, recorded with version and time | They own or may distribute what they submit; the licence they declare is true; they keep their keys safe and report compromise within 72 hours; the store may build, mirror, re-sign, delist and pull apps, and may block an installed app from starting when it is malicious; no warranty, limited liability; governing law of the operator's country. |
| Terms of use                  | Users, by using the site or Schelf                                   | Apps are made by third parties and licensed by them, not by the store; the store may remove apps and stop installed ones from starting for safety; how to report a problem.                                                                                                                                                                             |
| Privacy policy                | Shown on the site and in Schelf's About                              | What is collected (accounts for developers; no user accounts for installing), what the update and download counters store (nothing per person, see [data](data.md#counting-without-tracking)), server logs kept 7 days, processors (Cloudflare, GitHub, OpenRouter for review), contact for requests.                                                   |
| Content and review guidelines | Developers, linked from the agreement                                | What gets rejected: malware, undisclosed data collection, impersonation, apps that need permissions they do not use, spam and copycats, illegal content. Written as examples, not a legal text.                                                                                                                                                         |

Each document carries a version and date. The developer agreement is re-accepted when it changes in substance; the others take effect by publication with 30 days' notice.

## EU Digital Services Act

The store hosts and distributes third-party apps, so it is a hosting service and an online platform under the DSA. As a micro or small enterprise it is exempt from most platform-only duties (the extra transparency reports, the internal complaint system's full form, trader traceability beyond the basics), but these apply to everyone and are cheap to do right:

| Duty                                      | How the store meets it                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Single point of contact (Art. 11, 12)     | `legal@schelf.store`, listed on a `/legal/contact` page, with the languages it answers in. Mail to it becomes an item in Pult and gets a short receipt; the other addresses are in [review](review.md#email).                                                                                                                                                                        |
| Notice and action (Art. 16)               | A report form on every app page and in Schelf. It asks for the reason, an explanation, where exactly, and the reporter's name and email (optional for child abuse material). Each report becomes an item in the Reports inbox in Pult and gets a confirmation email. When the item is actioned or dismissed the reporter is told, and answers to either email land back on the item. |
| Statement of reasons (Art. 17)            | When an app or listing is removed, restricted or delisted, the developer gets an email with what was done, why, the facts it relied on, whether it was automated, and how to appeal. The text is generated from the decision in Pult.                                                                                                                                                |
| Appeals                                   | The developer replies to the statement and it reopens the item in Pult for a human to decide again.                                                                                                                                                                                                                                                                                  |
| Terms that explain moderation (Art. 14)   | The guidelines say what review checks, that automated filtering is a first pass that can only decline obvious junk submissions, and that a person makes every other rejection and every removal.                                                                                                                                                                                     |
| Trusted flaggers, out-of-court settlement | Accept and prioritise if they ever appear; nothing to build.                                                                                                                                                                                                                                                                                                                         |

## Copyright (DMCA and EU)

Repositories are open source, so most copyright problems are trademark-like: someone ships another project's work under their own name. The same report form takes copyright notices, so does `dmca@schelf.store`, and a separate `/legal/dmca` page lists what a valid DMCA notice needs and names the designated agent. Registering an agent with the US Copyright Office costs $6 every three years and is worth doing for safe-harbour protection, since many developers and users are in the US. A counter-notice path restores an app after 10–14 business days unless the claimant goes to court.

## Licences

Open source only at launch means the listing's licence must be an OSI-approved or FSF-free licence, read from the repository and checked by the checks workflow (see [review](review.md#the-facts)). The store redistributes binaries, so it also needs to meet the licence's conditions: GPL apps need a source offer, which the store meets by linking the exact commit on every release page and keeping the source tarball in R2 next to the build.

## Later, with paid apps

A company, a merchant of record (Paddle or Polar handle VAT and invoicing), a sale clause in the developer agreement, refunds, the DSA's trader traceability (Art. 30), and consumer law withdrawal rules for digital content. None of it changes the data model; see [phases](design.md#phases).

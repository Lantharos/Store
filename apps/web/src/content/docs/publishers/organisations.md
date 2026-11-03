---

title: Organisations
description: Publish as yourself or as an organisation, with members, roles and a public page.
---

Everything on Schelf is published by a publisher. When you sign in for the first time you get your own: your name on your apps, your namespaces, your page. If you make apps with other people or for a company, create an organisation as well. You can belong to as many as you like, and switch between them at the top of the dashboard's sidebar. Settings for the publisher you picked, and for your own account, are under **Settings**.

An organisation owns its apps, namespaces, trusted publishers and tokens. People come and go; the apps stay with the organisation.

## Creating one

Choose **New organisation** in the publisher menu, give it a name and accept the developer agreement on its behalf. You become its owner. Then invite the others from **Settings → Members**.

## Roles

| Role      | Can                                                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Owner     | Everything: invite and remove anyone, change roles including other owners, accept the agreement, ask for verification.        |
| Admin     | Add apps and namespaces, manage trusted publishers and tokens, invite and remove developers and admins, edit the public page. |
| Developer | Edit listings, screenshots and translations, and manage releases and rollouts.                                                |

Every member can see the organisation's apps, releases and stats, and every member gets the emails about its releases.

## Inviting people

Invite someone by email address or by GitHub username. An email invitation goes to that address; a GitHub invitation is accepted by whoever signs in with that GitHub account. Invitations show up in the dashboard after signing in and work for 14 days.

## Owners

An organisation always has at least one owner. To step down, make someone else an owner first, or use **Make owner and step down** on their row in **Settings → Members**, which swaps your roles. The last owner can't leave, and can't delete their account while other people are still members.

## The public page

Each publisher has a page at `schelf.store/publishers/<address>` with its logo, name, a short description, its website, and its apps and extensions. Edit it under **Settings → Profile**. Logos are cropped to a square when you upload them.

## In the command line

`schelf whoami` lists the publishers you belong to. When you have more than one, `schelf init` asks which one a new app belongs to, or takes `--publisher <address>` in scripts.

---

title: Closed-source apps
description: Schelf hosts and lists apps whose source isn't public, and says so plainly.
---

Your app doesn't have to be open source to be on Schelf. When you make a project, pick **Closed source**. You can publish from a private repository's GitHub Actions or [upload releases](/docs/manual-uploads) yourself.

## What changes

- **The page says "Closed source"** where an open-source app shows its licence and repository.
- **The checks look at the build, not the code.** Every file is scanned for malware and opened up to see what it contains and what it does. There's no source to compare between releases and no licence to check.
- **The repository stays private.** Schelf only needs to know which workflow is allowed to publish; it doesn't read your code.

Licence checks apply only when a project says it's open source. Then Schelf reads the licence from the repository and the build and checks it against the OSI and FSF lists.

## Listing a closed-source app

Closed-source apps can be [listed](/docs/host-your-releases#listed-or-unlisted) in the store too. The reviewer looks at the app as it runs, since there's no code to read, and the listing says it's closed source.

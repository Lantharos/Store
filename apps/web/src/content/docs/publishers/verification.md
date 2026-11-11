---

title: Verification
description: How a publisher earns the checkmark, what you send and what Schelf checks.
---

The checkmark next to a publisher's name tells people that Schelf checked who is behind it and that its domains are its own. It shows on the publisher's page, on each of its apps and in the Schelf app. It's separate from namespaces: proving a namespace lets you publish ids under it, while verification is about who you are. Only a verified publisher's extensions can [run inside Luft](/docs/luft-extensions#running-inside-luft), and they stop doing so if the checkmark is taken away.

Verification is done by a person, not automatically. An owner asks for it under **Settings → Verification** in the dashboard.

## What you send

- Your legal or trading name.
- Your website, and the domains you publish under, up to five.
- A contact email on one of those domains. You confirm it with a code we send to it.
- Your GitHub organisation, if you have one. It's proven when you're one of its owners and your account is connected to GitHub.
- A few sentences on who you are, and optionally documents such as a company register extract or a trademark registration, as PDF, PNG or JPEG. Only the people reviewing your request see them.

## Proving your domains

A domain counts as proven when you've already proven its namespace, so if you publish under `com.example`, `example.com` is done. For any other domain, add a TXT record with the value the dashboard shows, `schelf-verify=…`, or serve it in a file at `https://<domain>/.well-known/schelf-store.txt`. Press **Check again** once it's in place; DNS changes can take a few minutes.

## What Schelf checks

Alongside what you send, the reviewer sees:

- whether each domain is proven, and how;
- how long each domain has been registered;
- whether your website and contact email are on those domains;
- whether you own the GitHub organisation, and how old it is;
- your proven namespaces, and whether they match your domains;
- your listed apps and their installs;
- whether any of your apps was flagged for impersonation, and whether another publisher uses the same name or domains.

## After you send it

Requests are usually answered within three days, by email and in the dashboard, which shows what you sent and the request's history: what was checked, every question and answer, and the decision. The reviewer can:

- **approve** it, and the checkmark appears within a minute;
- **ask for more**, with a message. Answer in the dashboard; you can change your details before you do, and your answer sends the request back for review;
- **decline** it, with the reason. You can ask again once you've sorted it out; your new request starts from what you sent last time.

Verification can be removed later, for example if a domain changes hands, and you're told why. If your name, domains or the people behind your organisation change, write to [legal@schelf.store](mailto:legal@schelf.store).

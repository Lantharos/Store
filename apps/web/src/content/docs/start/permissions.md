---

title: Permissions
description: Declare what your app needs, so Luft can keep it to that and people can see it before they install.
---

Apps on Schelf say up front what they need. People see it on your store page and before they install, in plain words: which folders, which devices, whether it uses the internet. On Luft, AppImages are held to exactly what they declare.

Declarations use Luft's shared permission format: a `[sandbox]` table, either in `Sabine.toml` for Sabine apps or in a `permissions.toml` next to `schelf.toml` for AppImages. Point `permissions` in [schelf.toml](/docs/schelf-toml) at the file.

```toml
[sandbox]
network = false
filesystems = ["xdg-pictures:ro", "xdg-music:ro", "xdg-videos"]
devices = []
microphone = true
talk = ["org.mpris.MediaPlayer2.*"]
```

## What you can ask for

| Key           | Values                                                                                                                     | Shown as                                |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `network`     | `true` (the default) or `false`                                                                                            | “The internet”, or “No internet access” |
| `filesystems` | `home`, `xdg-desktop`, `xdg-documents`, `xdg-download`, `xdg-music`, `xdg-pictures`, `xdg-videos`; add `:ro` for read only | “Pictures, Music and Videos folders”    |
| `devices`     | `usb`, `serial`, `all`                                                                                                     | “USB devices”                           |
| `microphone`  | `true` to record sound, from the microphone and from what the computer plays                                               | “The microphone”                        |
| `camera`      | `true` to use the computer's cameras                                                                                       | “The camera”                            |
| `x11`         | `true` if your app only works with X11, where apps can see each other's windows and typing                                 | “The older way of showing windows”      |
| `talk`        | D-Bus names your app talks to, like `org.mpris.MediaPlayer2.*`                                                             | “Talk to one other service”             |

Files people open with your app, through the file picker or by opening them from Rover, are always allowed. You don't need a folder permission for that.

## Full access

Some apps really need everything: a terminal, a backup tool, a system monitor. Say so, and say why in one sentence:

```toml
[sandbox]
unsandboxed = true
reason = "A terminal runs whatever you type."
```

The store page shows “Full access to your computer” with your reason, review looks harder, and on Luft people confirm it with an administrator's password. Leaving out the declaration entirely means the same thing, without a reason, so it's worth writing one.

Sabine apps run with full access on every system for now, because Sabine can't sandbox them yet. Declare what you need anyway: it's shown on your page, and it will be enforced as soon as Sabine can.

## Changing permissions in an update

Narrowing what you ask for needs nothing. Widening it, like adding a folder, the microphone or the network, sends the update to review with a note, and Schelf asks each person before installing it. Until they agree, they stay on the version they have. So ask for what you need in the first release rather than adding it bit by bit.

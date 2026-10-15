# mac-automation

Personal Mac automation shared across work and personal Macs. Put every new
Raycast script command or macOS Quick Action here instead of in a one-off folder.

## Layout

- `raycast/`: Raycast script commands. Each file carries `@raycast.*` metadata.
- `services/`: macOS Quick Actions (`.workflow` bundles).
- `services/hotkeys.txt`: keyboard shortcuts for the Quick Actions.
- `install.sh`: sets up this Mac. Running it again changes nothing.

## Set up a Mac

1. Clone the repo: `git clone git@github.com:2st3p/mac-automation.git /Users/Shared/mac-automation`
2. Run `/Users/Shared/mac-automation/install.sh`.
3. First Mac only: in Raycast Settings, open Script Commands, click + next to
   Script Folders, and add `/Users/Shared/mac-automation/raycast`. Raycast Cloud Sync
   copies the folder and its hotkeys to your other Macs.

The repo must live at `/Users/Shared/mac-automation`. Raycast stores folder
paths as absolute paths, and the home folder name differs between Macs, so every
Mac uses this fixed path. A symlink does not work because Raycast resolves it.

## Commands

| Name | Type | Shortcut | What it does |
|---|---|---|---|
| Open Default Browser | Raycast | Hyper+A (set in Raycast) | Opens or focuses this Mac's default browser |
| Archived Tabs | Raycast | none | Opens the archived tabs list in Arc |
| Copy URL | Quick Action, Chrome only | Cmd+Shift+C | Copies the current Chrome tab's URL |

Copy URL asks once for permission to control Google Chrome. If you denied it,
turn it on in System Settings > Privacy & Security > Automation.

## Rules

- This repo lives on personal GitHub. Keep out employer URLs, hostnames, tokens, and data.
- Name files in kebab-case.
- After adding a Quick Action, add its shortcut to `services/hotkeys.txt` and run `install.sh`.
- After adding a Raycast script, run Raycast's "Reload Script Commands".

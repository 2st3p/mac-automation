# mac-automation

Personal Mac automation shared across work and personal Macs. Put every new
Raycast script command, macOS Quick Action, or Chrome extension here instead of
in a one-off folder.

## Layout

- `raycast/`: Raycast script commands. Each file carries `@raycast.*` metadata.
- `services/`: macOS Quick Actions (`.workflow` bundles).
- `services/hotkeys.txt`: keyboard shortcuts for the Quick Actions.
- `chrome/`: unpacked Chrome extensions, for shortcuts inside Chrome.
- `install.sh`: sets up this Mac. Running it again changes nothing.

## Set up a Mac

1. Clone the repo: `git clone git@github.com:2st3p/mac-automation.git /Users/Shared/mac-automation`
2. Run `/Users/Shared/mac-automation/install.sh`.
3. In each Chrome profile, load every folder in `chrome/`: open
   `chrome://extensions`, turn on Developer mode, click Load unpacked, and pick
   the folder. Then open `chrome://extensions/shortcuts` and check each shortcut.
4. First Mac only: in Raycast Settings, open Script Commands, click + next to
   Script Folders, and add `/Users/Shared/mac-automation/raycast`. Raycast Cloud Sync
   copies the folder and its hotkeys to your other Macs.

The repo must live at `/Users/Shared/mac-automation`. Raycast stores folder
paths as absolute paths, and the home folder name differs between Macs, so every
Mac uses this fixed path. A symlink does not work because Raycast resolves it.

## Commands

| Name | Type | Shortcut | What it does |
|---|---|---|---|
| Open Default Browser | Raycast | Hyper+A (set in Raycast) | Shows this Mac's default browser, or hides it if it is already in front |
| Archived Tabs | Raycast | none | Opens the archived tabs list in Arc |
| Copy URL | Chrome extension | Cmd+Shift+C | Copies the current tab's URL and shows a toast |

Copy URL replaces Chrome's Cmd+Shift+C (Inspect Elements). Inspect Elements
keeps Cmd+Option+C, the same layout Dia uses. A Quick Action cannot take this
key, because Chrome's built-in shortcut runs first.

## Rules

- This repo lives on personal GitHub. Keep out employer URLs, hostnames, tokens, and data.
- Name files in kebab-case.
- After adding a Quick Action, add its shortcut to `services/hotkeys.txt` and run `install.sh`.
- After adding a Raycast script, run Raycast's "Reload Script Commands".
- After changing a Chrome extension, click its reload button in `chrome://extensions`.

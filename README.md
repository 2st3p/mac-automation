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
| Copy URL | Chrome extension (Tab Tools) | Cmd+Shift+C | Copies the current tab's URL and shows a toast |
| Rename tab | Chrome extension (Tab Tools) | Cmd+Shift+E, or right-click the page | Sets a name for this tab's URL. An empty name goes back to the automatic name |
| Tab names | Chrome extension (Tab Tools) | none | Names a tab when its title is vague or another tab shares it |
| Close unused tabs | Chrome extension (Tab Tools) | none | Closes tabs you have not opened for 24 hours. Set the time on the options page |

Copy URL replaces Chrome's Cmd+Shift+C (Inspect Elements). Inspect Elements
keeps Cmd+Option+C, the same layout Dia uses. A Quick Action cannot take this
key, because Chrome's built-in shortcut runs first.

Tab Tools lives in `chrome/copy-url/`. The folder keeps its old name because
Chrome ties an unpacked extension's ID, settings, and shortcuts to its folder.

How Tab Tools names a tab:

- A title is vague when it has at most 3 words and each word is the site's
  name, a generic word such as "Home", or a number.
- When two tabs with different URLs share a clear title, each gets its
  heading as a name only if the headings differ. Otherwise both keep the title.
- The automatic name is the page's main heading, then its share title
  (`og:title`). The ID from the URL follows in parentheses, as in
  "Launch review (12345)". With no heading, the name is the page type and ID.
- Names you set are stored on this Mac by URL. Tracking parameters such as
  `utm_` do not change the URL a name belongs to.
- The extension changes only the page title, so the site's icon stays.

Close unused tabs never closes pinned tabs, tabs in a group, tabs playing
sound, or the front tab of each window. Unused time starts when you leave a
tab, to within 15 minutes, and never before Tab Tools was installed. Time while
the Mac sleeps or Chrome is closed does not count. The options page lists the
last 50 tabs it closed.

## Rules

- This repo lives on personal GitHub. Keep out employer URLs, hostnames, tokens, and data.
- Name files in kebab-case.
- After adding a Quick Action, add its shortcut to `services/hotkeys.txt` and run `install.sh`.
- After adding a Raycast script, run Raycast's "Reload Script Commands".
- After changing a Chrome extension, click its reload button in `chrome://extensions`.

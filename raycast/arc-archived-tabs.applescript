#!/usr/bin/osascript

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Archived Tabs
# @raycast.mode silent

# Optional parameters:
# @raycast.icon 🤖

# Documentation:
# @raycast.description Opens list of archived tabs in Arc browser.

tell application "Arc"
    activate
end tell

delay 0.2

tell application "System Events"
    tell process "Arc"
        set frontmost to true
        try
            click (first button of toolbar 1 of window 1 whose description contains "Archive")
        on error
            click menu item "View Archive" of menu "View" of menu bar 1
        end try
    end tell
end tell

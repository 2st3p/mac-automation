#!/bin/bash

# Required Raycast parameters
# @raycast.schemaVersion 1
# @raycast.title Open Default Browser
# @raycast.mode silent

# Optional Raycast parameters
# @raycast.icon 🌐
# @raycast.packageName Browser
# @raycast.description Launch or focus this machine's default browser. Opens no tab, URL, or blank page.
# @raycast.author Erik Kernan

set -uo pipefail

# Resolve the default handler for https on THIS machine.
# NSWorkspace is a public API, so this needs no Full Disk Access and no hardcoded
# bundle ID. Passing a scheme-only URL is a lookup, not a request to open anything.
resolve_via_nsworkspace() {
  osascript -l JavaScript <<'JXA' 2>/dev/null
ObjC.import("AppKit");
const handler = $.NSWorkspace.sharedWorkspace.URLForApplicationToOpenURL(
  $.NSURL.URLWithString("https:")
);
handler.isNil() ? "" : ObjC.unwrap(handler.path);
JXA
}

# Fallback: read the LaunchServices handler map directly and resolve the bundle ID.
resolve_via_launchservices() {
  local plist="$HOME/Library/Preferences/com.apple.LaunchServices/com.apple.launchservices.secure.plist"
  [[ -r "$plist" ]] || return 1
  local bundle_id
  bundle_id=$(
    plutil -convert json -o - "$plist" 2>/dev/null |
      /usr/bin/python3 -c 'import json,sys
d=json.load(sys.stdin)
print(next((h.get("LSHandlerRoleAll","") for h in d.get("LSHandlers",[]) if h.get("LSHandlerURLScheme")=="https"),""))' 2>/dev/null
  )
  [[ -n "$bundle_id" ]] || return 1
  mdfind -onlyin /Applications -onlyin "$HOME/Applications" -onlyin /System/Applications \
    "kMDItemCFBundleIdentifier == '$bundle_id'" 2>/dev/null | head -n 1
}

APP_PATH="$(resolve_via_nsworkspace)"
[[ -n "$APP_PATH" && -d "$APP_PATH" ]] || APP_PATH="$(resolve_via_launchservices)"
[[ -n "$APP_PATH" && -d "$APP_PATH" ]] || APP_PATH="/Applications/Safari.app"

if [[ ! -d "$APP_PATH" ]]; then
  echo "Could not determine the default browser"
  exit 1
fi

# `open -a` with no file or URL argument is the no-side-effect activation path:
# already running -> activate in place, current tab and window untouched.
# not running     -> plain cold launch, same as clicking the Dock icon.
open -a "$APP_PATH" || {
  echo "Failed to open $(basename "${APP_PATH%.app}")"
  exit 1
}

#!/bin/bash
# Set up this repo's automation on this Mac. Running it again changes nothing.
set -euo pipefail

REPO="$(cd "$(dirname "$0")" && pwd)"
EXPECTED="/Users/Shared/mac-automation"

# Raycast Cloud Sync stores script folders as absolute paths, and home folder
# names differ between Macs. The repo lives at the same path on every Mac so the
# synced folder works everywhere. Raycast resolves symlinks, so a link does not help.
if [[ "$REPO" != "$EXPECTED" ]]; then
  echo "error: clone this repo to $EXPECTED, not $REPO." >&2
  exit 1
fi
chmod +x "$REPO"/raycast/*
echo "Raycast scripts: $REPO/raycast"

# Quick Actions. macOS does not load symlinked workflows reliably, so copy them.
mkdir -p "$HOME/Library/Services"
for wf in "$REPO"/services/*.workflow; do
  [[ -d "$wf" ]] || continue
  rsync -a --delete "$wf/" "$HOME/Library/Services/$(basename "$wf")/"
  echo "Quick Action: $(basename "$wf" .workflow)"
done

# Quick Action shortcuts.
while IFS='|' read -r name key; do
  [[ -z "$name" || "$name" == \#* ]] && continue
  defaults write pbs NSServicesStatus -dict-add "\"(null) - $name - runWorkflowAsService\"" \
    "{ enabled_context_menu = 1; enabled_services_menu = 1; key_equivalent = \"$key\"; presentation_modes = { ContextMenu = 1; ServicesMenu = 1; }; }"
  echo "Shortcut: $name = $key"
done < "$REPO/services/hotkeys.txt"
/System/Library/CoreServices/pbs -update

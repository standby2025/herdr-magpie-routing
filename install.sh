#!/bin/sh
# Installs the routing mod, then clones herdr's tabs mod and main layout and
# adds a Routing button right of Files / Changes. Shipped files stay untouched.
set -e
HOME_DIR="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
HERE="$(cd "$(dirname "$0")" && pwd)"

mkdir -p "$HOME_DIR/mods/routing"
cp "$HERE"/routing/* "$HOME_DIR/mods/routing/"
echo "routing mod installed"

[ "$1" = "--mod-only" ] && { echo "open it with: herdr-app do pane.split '{\"direction\":\"right\",\"mod\":\"routing\"}'"; exit 0; }

herdr-app do mod.clone '{"name":"tabs","as":"my-tabs"}' >/dev/null
herdr-app do layout.clone '{"name":"main","as":"my-layout"}' >/dev/null
python3 "$HERE/scripts/patch.py" "$HOME_DIR/mods/my-tabs/main.js" "$HOME_DIR/layouts/my-layout.json" my-tabs
echo "done: switched to layout my-layout (ctrl-shift-l cycles layouts)"

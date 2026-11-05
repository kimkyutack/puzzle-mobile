#!/bin/sh
set -eu
if [ "${CONFIGURATION:-}" != "Release" ]; then exit 0; fi
marker="${PROJECT_DIR}/App/public/native-build.json"
if [ ! -f "$marker" ]; then
    echo "error: Run VITE_API_URL=https://<worker>/api node tools/native-build.mjs release before archiving."
    exit 1
fi
mode=$(/usr/bin/plutil -extract mode raw -o - "$marker")
endpoint=$(/usr/bin/plutil -extract apiUrl raw -o - "$marker")
if [ "$mode" != "release" ]; then
    echo "error: A local debug bundle cannot be archived as Release."
    exit 1
fi
case "$endpoint" in
    https://localhost*|https://127.0.0.1*|https://\[::1\]*) echo "error: Release API cannot be a loopback address."; exit 1 ;;
    https://?*) ;;
    *) echo "error: Release requires a configured HTTPS API."; exit 1 ;;
esac

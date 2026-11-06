#!/usr/bin/env bash
# Copies the V2 contracts handoff bundle (addresses.json, abi-manifest.json, abis/*.json) into
# src/contracts/v2, after checking every ABI's SHA-256 and entry count against abi-manifest.json,
# then regenerates src/contracts/v2/abis.ts. A bundle that fails the check is never copied.
#   CONTRACTS_V2_HANDOFF  bundle directory (default ../v2, then ../SmartContracts/handoff/v2)
set -euo pipefail
cd "$(dirname "$0")/.."

SRC="${CONTRACTS_V2_HANDOFF:-}"
if [ -z "$SRC" ]; then
  for candidate in ../v2 ../SmartContracts/handoff/v2; do
    if [ -f "$candidate/abi-manifest.json" ]; then SRC="$candidate"; break; fi
  done
fi
if [ -z "$SRC" ] || [ ! -f "$SRC/abi-manifest.json" ] || [ ! -f "$SRC/addresses.json" ]; then
  echo "No V2 handoff bundle found. Set CONTRACTS_V2_HANDOFF to the folder with addresses.json, abi-manifest.json and abis/." >&2
  exit 1
fi

DEST=src/contracts/v2
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/abis"
cp "$SRC/addresses.json" "$SRC/abi-manifest.json" "$STAGE/"
cp "$SRC"/abis/*.json "$STAGE/abis/"
node scripts/gen-v2-abis.mjs --check "$STAGE"

mkdir -p "$DEST/abis"
rm -f "$DEST"/abis/*.json
cp "$STAGE/addresses.json" "$STAGE/abi-manifest.json" "$DEST/"
cp "$STAGE"/abis/*.json "$DEST/abis/"
node scripts/gen-v2-abis.mjs
echo "Synced V2 bundle $(node -p "require('./$DEST/addresses.json').version") from $SRC"

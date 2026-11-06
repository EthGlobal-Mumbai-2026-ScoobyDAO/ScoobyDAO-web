#!/usr/bin/env bash
# Regenerates src/contracts/generated.ts from the contracts repo's Foundry out/ and copies
# deployments/testnets.json. Run `forge build` in the contracts repo first.
#   CONTRACTS_REPO_PATH (default ../SmartContracts) · CONTRACTS_OUT (default $CONTRACTS_REPO_PATH/out)
set -euo pipefail
SRC="${CONTRACTS_REPO_PATH:-../SmartContracts}"
DEST="src/contracts"
CONTRACTS_REPO_PATH="$SRC" node scripts/gen-abis.mjs
cp "$SRC/deployments/testnets.json" "$DEST/testnets.json"
echo "Synced from $SRC at $(git -C "$SRC" rev-parse --short HEAD 2>/dev/null || echo unknown)"

#!/usr/bin/env bash
# Copies ABIs and Sepolia addresses from a local ScoobyDAO-contracts checkout.
set -euo pipefail
SRC="${CONTRACTS_REPO_PATH:-../ScoobyDAO-contracts}"
DEST="src/contracts"
mkdir -p "$DEST/abi"
cp "$SRC"/abi/*.json "$DEST/abi/"
cp "$SRC/deployments/sepolia.json" "$DEST/sepolia.json"
echo "Synced from $SRC at $(git -C "$SRC" rev-parse --short HEAD 2>/dev/null || echo unknown)"

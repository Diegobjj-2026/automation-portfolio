#!/bin/sh
# Runs demo 01 in a throwaway n8n container: no network, no ports, files only under /demo.
# Usage (Git Bash, repo root): sh demo-01-invoice-to-sheet/run-local.sh
# Tested with docker.n8n.io/n8nio/n8n:latest = 2.32.6.
set -e
D=demo-01-invoice-to-sheet
node "$D/build-workflow.js" >/dev/null
mkdir -p "$D/output"
rm -f "$D/output/invoices.xlsx" "$D/output/needs-review.csv"
HERE="$(cd "$D" && (pwd -W 2>/dev/null || pwd))"
MSYS_NO_PATHCONV=1 docker run --rm --network none \
  -e N8N_RESTRICT_FILE_ACCESS_TO=/demo -e N8N_DIAGNOSTICS_ENABLED=false -e N8N_VERSION_NOTIFICATIONS_ENABLED=false \
  -e N8N_PERSONALIZATION_ENABLED=false -e N8N_BLOCK_ENV_ACCESS_IN_NODE=true \
  -v "$HERE/samples:/demo/samples:ro" -v "$HERE/workflow.json:/demo/workflow.json:ro" -v "$HERE/output:/demo/output" \
  --entrypoint sh docker.n8n.io/n8nio/n8n:latest -c '
    n8n import:workflow --input=/demo/workflow.json >/dev/null 2>&1
    n8n execute --id=Demo01InvoiceToSheet --rawOutput > /demo/output/last-run.json 2>/demo/output/last-run.err || { echo "n8n execute failed" >&2; tail -20 /demo/output/last-run.err >&2; exit 1; }'
ls -l "$D/output"

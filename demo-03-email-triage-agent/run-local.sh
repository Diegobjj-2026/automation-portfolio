#!/bin/sh
# Runs demo 03 in a throwaway n8n container: no ports, files only under /demo.
# Needs OPENAI_API_KEY in the environment. It is passed to the container by name (never on the
# command line), turned into an n8n credential inside the container and gone when it stops.
# Usage (Git Bash, repo root): OPENAI_API_KEY=... sh demo-03-email-triage-agent/run-local.sh
# Tested with docker.n8n.io/n8nio/n8n:latest = 2.32.6 and gpt-4.1-mini-2025-04-14.
set -e
[ -n "$OPENAI_API_KEY" ] || { echo "OPENAI_API_KEY is not set" >&2; exit 1; }
D=demo-03-email-triage-agent
node "$D/build-workflow.js" >/dev/null
mkdir -p "$D/output"
rm -f "$D/output/triage.csv" "$D/output/drafts-for-approval.md"
HERE="$(cd "$D" && (pwd -W 2>/dev/null || pwd))"
MSYS_NO_PATHCONV=1 docker run --rm -e OPENAI_API_KEY \
  -e N8N_RESTRICT_FILE_ACCESS_TO=/demo -e N8N_DIAGNOSTICS_ENABLED=false -e N8N_VERSION_NOTIFICATIONS_ENABLED=false \
  -e N8N_PERSONALIZATION_ENABLED=false -e N8N_BLOCK_ENV_ACCESS_IN_NODE=true \
  -v "$HERE/samples:/demo/samples:ro" -v "$HERE/workflow.json:/demo/workflow.json:ro" -v "$HERE/output:/demo/output" \
  --entrypoint sh docker.n8n.io/n8nio/n8n:latest -c '
    node -e "require(\"fs\").writeFileSync(\"/tmp/cred.json\", JSON.stringify([{id:\"openaiDemo\",name:\"OpenAI (demo)\",type:\"openAiApi\",data:{apiKey:process.env.OPENAI_API_KEY}}]))"
    n8n import:credentials --input=/tmp/cred.json >/dev/null 2>&1; rm -f /tmp/cred.json
    unset OPENAI_API_KEY
    n8n import:workflow --input=/demo/workflow.json >/dev/null 2>&1
    n8n execute --id=Demo03EmailTriageAgent --rawOutput > /demo/output/last-run.json 2>/demo/output/last-run.err || { echo "n8n execute failed" >&2; tail -20 /demo/output/last-run.err >&2; exit 1; }'
# The key must never end up in an output file.
if grep -rlE "sk-[A-Za-z0-9_-]{20,}" "$D/output" >/dev/null 2>&1; then echo "SECRET FOUND IN OUTPUT, files removed" >&2; rm -f "$D/output/"*; exit 1; fi
ls -l "$D/output"

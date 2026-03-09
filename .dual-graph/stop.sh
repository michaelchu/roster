#!/usr/bin/env bash
INPUT=$(cat)
TRANSCRIPT=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('transcript_path',''))" 2>/dev/null || echo "")
if [[ -n "$TRANSCRIPT" && -f "$TRANSCRIPT" ]]; then
  CHARS=$(python3 - "$TRANSCRIPT" 2>/dev/null << 'PYEOF'
import json, sys
lines = open(sys.argv[1]).readlines()
for line in reversed(lines):
    try:
        msg = json.loads(line)
        if msg.get("type") == "assistant":
            print(len(str(msg.get("message", {}).get("content", ""))))
            break
    except Exception:
        pass
PYEOF
)
  OUT=$(( ${CHARS:-0} / 4 ))
  IN=$(( OUT * 4 ))
  PROJECT_PATH="/Users/michaelchu/Documents/Projects/roster"
  PORT_FILE="$HOME/.claude/token-counter/dashboard-port.txt"
  DASH_PORT=8899
  if [[ -f "$PORT_FILE" ]]; then DASH_PORT=$(cat "$PORT_FILE"); fi
  curl -sf -X POST "http://localhost:$DASH_PORT/log"     -H "Content-Type: application/json"     -d "{\"input_tokens\":$IN,\"output_tokens\":$OUT,\"model\":\"claude-sonnet-4-6\",\"description\":\"auto\",\"project\":\"$PROJECT_PATH\"}"     >/dev/null 2>&1 || true
fi
exit 0

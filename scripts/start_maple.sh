#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
CHATBOT_DIR="$ROOT_DIR/frontend/chatbot"
DASHBOARD_DIR="$ROOT_DIR/frontend/dashboard"

BACKEND_PORT="${BACKEND_PORT:-8000}"
CHATBOT_PORT="${CHATBOT_PORT:-3001}"
DASHBOARD_PORT="${DASHBOARD_PORT:-3002}"

pids=()

cleanup() {
  echo
  echo "Stopping MAPLE services..."
  for pid in "${pids[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait || true
}

trap cleanup EXIT INT TERM

if [ -f "$BACKEND_DIR/.venv/bin/activate" ]; then
  source "$BACKEND_DIR/.venv/bin/activate"
fi

if ! python3 - <<'PY' >/dev/null 2>&1
import importlib.util
raise SystemExit(0 if importlib.util.find_spec("uvicorn") else 1)
PY
then
  echo "Missing dependency: uvicorn"
  echo "Run: make install"
  exit 1
fi

echo "Starting MAPLE backend on :$BACKEND_PORT ..."
(
  cd "$BACKEND_DIR"
  python3 -m uvicorn main:app --reload --host 0.0.0.0 --port "$BACKEND_PORT"
) &
pids+=("$!")

echo "Starting Chatbot frontend on :$CHATBOT_PORT ..."
(
  cd "$CHATBOT_DIR"
  python3 -m http.server "$CHATBOT_PORT"
) &
pids+=("$!")

echo "Starting Dashboard frontend on :$DASHBOARD_PORT ..."
(
  cd "$DASHBOARD_DIR"
  python3 -m http.server "$DASHBOARD_PORT"
) &
pids+=("$!")

echo
echo "MAPLE is running:"
echo "- Backend:   http://localhost:$BACKEND_PORT"
echo "- Chatbot:   http://localhost:$CHATBOT_PORT"
echo "- Dashboard: http://localhost:$DASHBOARD_PORT"
echo
echo "Press Ctrl+C to stop all services."

wait

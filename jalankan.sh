#!/usr/bin/env bash
# Jalankan ScheduleSim di komputer ini: http://127.0.0.1:${PORT:-8000}
set -euo pipefail
cd "$(dirname "$0")"
git submodule update --init vendor/arls-ppo
LOCK=vendor/arls-ppo/exp1/dfjsp-ppo-repair/requirements-lock.txt
if [ ! -x backend/.venv/bin/python ]; then
  python3 -m venv backend/.venv
  backend/.venv/bin/pip install --upgrade pip
  backend/.venv/bin/pip install -r "$LOCK" fastapi==0.128.0 uvicorn==0.40.0
fi
if [ ! -f frontend/dist/index.html ]; then
  (cd frontend && npm ci --no-audit --no-fund && npm run build)
fi
cd backend
OMP_NUM_THREADS=1 exec .venv/bin/python -m uvicorn schedulesim.api:app \
  --host 127.0.0.1 --port "${PORT:-8000}"

#!/bin/bash
# Run Django from deployed source on wwwroot — not a stale Oryx /tmp extract.
set -euo pipefail

cd /home/site/wwwroot

if [ ! -d "antenv" ]; then
  python -m venv antenv
fi
source antenv/bin/activate

pip install --upgrade pip -q
pip install -r requirements.txt -q

exec gunicorn modify_style_backend.wsgi:application \
  --bind=0.0.0.0:8000 \
  --timeout 120 \
  --workers 2 \
  --chdir /home/site/wwwroot

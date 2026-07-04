#!/bin/bash
# Oryx activates antenv and sets PYTHONPATH before running this script.
set -euo pipefail
exec gunicorn modify_style_backend.wsgi:application \
  --bind=0.0.0.0:8000 \
  --timeout 120 \
  --workers 2

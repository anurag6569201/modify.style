#!/bin/bash
set -e
cd /home/site/wwwroot
if [ -d "antenv" ]; then
  source antenv/bin/activate
elif [ -f "requirements.txt" ]; then
  python -m venv antenv
  source antenv/bin/activate
  pip install --upgrade pip
  pip install -r requirements.txt
fi
exec gunicorn modify_style_backend.wsgi:application --bind=0.0.0.0:8000 --timeout 120 --workers 2

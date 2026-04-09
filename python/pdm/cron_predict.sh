#!/bin/bash
# ============================================
# PdM Cron Job - Run daily predictions
# ============================================
# Install in crontab:
#   0 3 * * * /path/to/cron_predict.sh >> /var/log/pdm_cron.log 2>&1
#
# This runs at 3:00 AM daily:
#   1. Syncs new equipment from ordenes_taller
#   2. Runs batch predictions for all active equipment
#   3. Retrains model weekly (on Sundays)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

echo "$(date) - Starting PdM daily run..."

# Step 1: Run batch predictions
echo "$(date) - Running batch predictions..."
python3 model.py predict-all

# Step 2: Retrain on Sundays (day 0)
if [ "$(date +%u)" -eq 7 ]; then
    echo "$(date) - Sunday: retraining model..."
    python3 model.py train
    echo "$(date) - Retraining complete"
fi

echo "$(date) - PdM daily run complete"

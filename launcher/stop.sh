#!/bin/bash
# Agent OS - Stop Script
# Ferma tutti i processi dell'app

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$APP_DIR/launcher/agent-os.pids"

RED='\033[0;31m'
NC='\033[0m'

echo -e "${RED}[Agent OS] Arresto processi...${NC}"

if [ -f "$PID_FILE" ]; then
    while read -r pid; do
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null
            echo -e "${RED}  Processo $pid terminato${NC}"
        fi
    done < "$PID_FILE"
    rm -f "$PID_FILE"
fi

# Kill any tsx/vite processes for this project
pkill -f "tsx.*AgenteOSBrain" 2>/dev/null
pkill -f "vite.*AgenteOSBrain" 2>/dev/null

echo -e "${RED}[Agent OS] Tutto arrestato.${NC}"

#!/bin/bash
# Agent OS - Launcher Script
# Avvia backend + frontend e apre il browser
# Alla chiusura, termina tutti i processi dell'app

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_FILE="$APP_DIR/launcher/agent-os.log"
PID_FILE="$APP_DIR/launcher/agent-os.pids"
BACKEND_PORT="${AGENT_OS_BACKEND_PORT:-43101}"
FRONTEND_PORT="${AGENT_OS_FRONTEND_PORT:-43173}"

export AGENT_OS_BACKEND_PORT="$BACKEND_PORT"
export AGENT_OS_FRONTEND_PORT="$FRONTEND_PORT"
export PORT="$BACKEND_PORT"
export VITE_PORT="$FRONTEND_PORT"

# Colori
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

cleanup() {
    echo -e "\n${RED}[Agent OS] Arresto in corso...${NC}"
    if [ -f "$PID_FILE" ]; then
        while read -r pid; do
            if kill -0 "$pid" 2>/dev/null; then
                kill "$pid" 2>/dev/null
                echo -e "${RED}[Agent OS] Processo $pid terminato${NC}"
            fi
        done < "$PID_FILE"
        rm -f "$PID_FILE"
    fi
    # Kill any remaining child processes
    pkill -P $$ 2>/dev/null
    echo -e "${RED}[Agent OS] Tutti i processi terminati. Arrivederci!${NC}"
    exit 0
}

trap cleanup EXIT INT TERM

stop_existing() {
    if [ -f "$PID_FILE" ]; then
        while read -r pid; do
            if kill -0 "$pid" 2>/dev/null; then
                kill "$pid" 2>/dev/null
            fi
        done < "$PID_FILE"
        rm -f "$PID_FILE"
    fi

    pkill -f "tsx .*backend/src/index.ts" 2>/dev/null || true
    pkill -f "vite --config frontend/vite.config.ts frontend/" 2>/dev/null || true
    pkill -f "AgenteOSBrain.*backend/src/index.ts" 2>/dev/null || true
    pkill -f "AgenteOSBrain.*frontend/vite.config.ts" 2>/dev/null || true
    sleep 1
}

wait_for_url() {
    local url="$1"
    local name="$2"
    local attempts="${3:-30}"

    for i in $(seq 1 "$attempts"); do
        if curl -s "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}[Agent OS] ${name} pronto!${NC}"
            return 0
        fi
        sleep 1
    done

    echo -e "${RED}[Agent OS] ${name} non risponde su ${url}${NC}"
    return 1
}

echo -e "${BLUE}"
echo "  ╔═══════════════════════════════════════╗"
echo "  ║          A G E N T   O S              ║"
echo "  ║   Orchestrazione Agenti IA            ║"
echo "  ╚═══════════════════════════════════════╝"
echo -e "${NC}"

cd "$APP_DIR"

mkdir -p "$(dirname "$LOG_FILE")"
: > "$LOG_FILE"

# Check node
if ! command -v node &>/dev/null; then
    echo -e "${RED}[Errore] Node.js non trovato. Installalo prima di continuare.${NC}"
    exit 1
fi

# Install deps if needed
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}[Agent OS] Installazione dipendenze...${NC}"
    npm install >> "$LOG_FILE" 2>&1
fi

# Stop stale processes from previous launcher runs
echo -e "${BLUE}[Agent OS] Pulizia processi esistenti...${NC}"
stop_existing

# Clear PID file
> "$PID_FILE"

# Start backend
echo -e "${GREEN}[Agent OS] Avvio backend sulla porta ${BACKEND_PORT}...${NC}"
./node_modules/.bin/tsx backend/src/index.ts >> "$LOG_FILE" 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID >> "$PID_FILE"

# Wait for backend
echo -e "${BLUE}[Agent OS] Attendo avvio backend...${NC}"
wait_for_url "http://localhost:${BACKEND_PORT}/api/v1/projects" "Backend" 30 || exit 1

# Start frontend
echo -e "${GREEN}[Agent OS] Avvio frontend sulla porta ${FRONTEND_PORT}...${NC}"
./node_modules/.bin/vite --strictPort --config frontend/vite.config.ts frontend/ >> "$LOG_FILE" 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID >> "$PID_FILE"

# Wait for frontend
wait_for_url "http://localhost:${FRONTEND_PORT}" "Frontend" 30 || exit 1

# Open browser
echo -e "${GREEN}[Agent OS] Apertura browser...${NC}"
open "http://localhost:${FRONTEND_PORT}" 2>/dev/null || xdg-open "http://localhost:${FRONTEND_PORT}" 2>/dev/null

echo -e "${GREEN}"
echo "  ✓ Backend:  http://localhost:${BACKEND_PORT}"
echo "  ✓ Frontend: http://localhost:${FRONTEND_PORT}"
echo ""
echo "  Premi Ctrl+C per arrestare Agent OS"
echo -e "${NC}"

# Wait for processes
wait

#!/bin/bash
# Agent OS - Installa collegamento sul Desktop
# Crea un alias/link sul Desktop per avvio rapido

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DESKTOP="$HOME/Desktop"
APP_SOURCE="$APP_DIR/launcher/AgentOS.app"

echo "╔═══════════════════════════════════════╗"
echo "║   Agent OS - Installazione Desktop    ║"
echo "╚═══════════════════════════════════════╝"
echo ""

# Create symlink on Desktop
if [ -e "$DESKTOP/Agent OS.app" ] || [ -L "$DESKTOP/Agent OS.app" ]; then
    rm -rf "$DESKTOP/Agent OS.app"
fi

ln -s "$APP_SOURCE" "$DESKTOP/Agent OS.app"

if [ -L "$DESKTOP/Agent OS.app" ]; then
    echo "✓ Collegamento creato sul Desktop: Agent OS.app"
    echo ""
    echo "  Doppio click su 'Agent OS' dal Desktop per avviare."
    echo "  Chiudi il terminale o premi Ctrl+C per arrestare."
else
    echo "✗ Errore nella creazione del collegamento."
    echo "  Puoi avviare manualmente con: bash $APP_DIR/launcher/start.sh"
fi

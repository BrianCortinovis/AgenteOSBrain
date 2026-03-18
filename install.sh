#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Agent OS Brain — Installer
#  Usage: curl -fsSL https://raw.githubusercontent.com/briancortinovis/AgenteOSBrain/main/install.sh | bash
# ═══════════════════════════════════════════════════════════════

set -e

REPO="briancortinovis/AgenteOSBrain"  # Cambia con il tuo username GitHub
APP_NAME="Agent OS Brain"
INSTALL_DIR="/Applications"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

print_banner() {
  echo ""
  echo -e "${BLUE}${BOLD}"
  echo "  ╔══════════════════════════════════════╗"
  echo "  ║       Agent OS Brain Installer       ║"
  echo "  ║     AI Agent Orchestration System    ║"
  echo "  ╚══════════════════════════════════════╝"
  echo -e "${NC}"
}

detect_arch() {
  local arch=$(uname -m)
  case "$arch" in
    arm64|aarch64) echo "arm64" ;;
    x86_64|amd64)  echo "x64" ;;
    *) echo ""; return 1 ;;
  esac
}

detect_os() {
  local os=$(uname -s)
  case "$os" in
    Darwin) echo "macos" ;;
    Linux)  echo "linux" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *) echo ""; return 1 ;;
  esac
}

check_deps() {
  echo -e "${BLUE}[1/4]${NC} Controllo prerequisiti..."

  # Check Node.js
  if ! command -v node &>/dev/null; then
    echo -e "${RED}✗ Node.js non trovato${NC}"
    echo "  Installa Node.js 20+: https://nodejs.org/"
    echo "  Oppure: brew install node"
    exit 1
  fi

  local node_ver=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$node_ver" -lt 18 ]; then
    echo -e "${RED}✗ Node.js $node_ver troppo vecchio (richiesto 18+)${NC}"
    exit 1
  fi
  echo -e "  ${GREEN}✓${NC} Node.js $(node -v)"
}

get_latest_release() {
  curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | \
    grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/'
}

install_desktop() {
  local arch=$(detect_arch)
  local version=$(get_latest_release)

  if [ -z "$version" ]; then
    echo -e "${RED}✗ Impossibile trovare l'ultima release${NC}"
    echo "  Controlla: https://github.com/$REPO/releases"
    exit 1
  fi

  echo -e "${BLUE}[2/4]${NC} Download $APP_NAME $version ($arch)..."

  local dmg_name="AgentOSBrain-${arch}.dmg"
  local download_url="https://github.com/$REPO/releases/download/$version/$dmg_name"
  local tmp_dmg="/tmp/$dmg_name"

  curl -fsSL -o "$tmp_dmg" "$download_url" || {
    echo -e "${RED}✗ Download fallito${NC}"
    echo "  URL: $download_url"
    echo "  Scarica manualmente: https://github.com/$REPO/releases"
    exit 1
  }

  echo -e "${BLUE}[3/4]${NC} Installazione..."

  # Mount DMG, copy app, unmount
  local mount_point=$(hdiutil attach "$tmp_dmg" -nobrowse -quiet | grep "/Volumes" | awk '{print $NF}')

  if [ -d "$INSTALL_DIR/$APP_NAME.app" ]; then
    echo "  Rimozione versione precedente..."
    rm -rf "$INSTALL_DIR/$APP_NAME.app"
  fi

  cp -R "$mount_point/$APP_NAME.app" "$INSTALL_DIR/"
  hdiutil detach "$mount_point" -quiet
  rm -f "$tmp_dmg"

  echo -e "${BLUE}[4/4]${NC} Configurazione..."

  # Remove quarantine attribute
  xattr -rd com.apple.quarantine "$INSTALL_DIR/$APP_NAME.app" 2>/dev/null || true

  echo ""
  echo -e "${GREEN}${BOLD}✓ $APP_NAME installato con successo!${NC}"
  echo ""
  echo "  Apri l'app:"
  echo -e "  ${BOLD}open '$INSTALL_DIR/$APP_NAME.app'${NC}"
  echo ""
  echo "  Al primo avvio:"
  echo "  1. Vai in Impostazioni > Provider"
  echo "  2. Inserisci almeno una API key (OpenAI, Anthropic, o Gemini)"
  echo "  3. Crea il tuo primo progetto!"
  echo ""
}

install_cli() {
  # Alternativa: installa come webapp locale (senza Tauri)
  echo -e "${BLUE}[2/4]${NC} Clonazione repository..."

  local install_path="$HOME/.agenteos"

  if [ -d "$install_path" ]; then
    echo "  Aggiornamento installazione esistente..."
    cd "$install_path" && git pull --quiet
  else
    git clone --depth 1 "https://github.com/$REPO.git" "$install_path"
  fi

  echo -e "${BLUE}[3/4]${NC} Installazione dipendenze..."
  cd "$install_path" && npm ci --quiet

  echo -e "${BLUE}[4/4]${NC} Build..."
  npm run build --quiet

  # Create symlink
  local bin_dir="$HOME/.local/bin"
  mkdir -p "$bin_dir"
  ln -sf "$install_path/bin/agenteos.js" "$bin_dir/agenteos"
  chmod +x "$install_path/bin/agenteos.js"

  echo ""
  echo -e "${GREEN}${BOLD}✓ Agent OS Brain installato!${NC}"
  echo ""
  echo "  Avvia il server:"
  echo -e "  ${BOLD}agenteos start${NC}"
  echo ""
  echo "  Oppure:"
  echo -e "  ${BOLD}cd $install_path && npm start${NC}"
  echo ""
  echo "  Apri nel browser: http://localhost:43173"
  echo ""

  # Check PATH
  if ! echo "$PATH" | grep -q "$bin_dir"; then
    echo -e "  ${BLUE}Nota:${NC} aggiungi $bin_dir al PATH:"
    echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
    echo ""
  fi
}

# ─── Main ───

print_banner

OS=$(detect_os)
ARCH=$(detect_arch)

echo -e "  Sistema: ${BOLD}$OS $ARCH${NC}"
echo ""

check_deps

if [ "$OS" = "macos" ]; then
  echo ""
  echo "  Scegli modalita di installazione:"
  echo ""
  echo "  ${BOLD}1)${NC} App Desktop (DMG) — finestra nativa, tutto incluso"
  echo "  ${BOLD}2)${NC} Webapp locale (CLI) — avvia da terminale, apri nel browser"
  echo ""
  read -p "  Scelta [1/2]: " choice

  case "$choice" in
    1) install_desktop ;;
    2) install_cli ;;
    *) echo "Scelta non valida"; exit 1 ;;
  esac
else
  # Linux/Windows: solo CLI mode
  install_cli
fi

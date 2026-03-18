# Agent OS Brain — Desktop App (Tauri)

## Prerequisiti

- **macOS 11+** (Apple Silicon M1/M2/M3)
- **Node.js 20+** — necessario anche nell'app finale (per il backend sidecar)
- **Rust** — `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **Tauri CLI** — `cargo install tauri-cli --version "^2"`

## Comandi

### Sviluppo (hot reload)

```bash
# Dalla root del progetto
cd desktop
npm run dev
```

Apre la finestra Tauri con hot reload del frontend e backend in watch mode.

### Build app .app + .dmg

```bash
cd desktop
npm run build:app
```

Output: `desktop/src-tauri/target/release/bundle/`
- `Agent OS Brain.app` — applicazione macOS
- `Agent OS Brain.dmg` — installer DMG

### Come funziona

1. **Frontend**: il frontend React viene buildato come file statici e serviti direttamente da Tauri (no webserver)
2. **Backend**: il backend Express+SQLite viene bundlato con esbuild in un singolo file JS, poi eseguito come processo sidecar tramite Node.js
3. **Database**: SQLite salvato in `~/Library/Application Support/com.agenteos.brain/`
4. **Outputs**: file generati salvati in `~/Library/Application Support/com.agenteos.brain/outputs/`

### Struttura

```
desktop/
  src-tauri/           # Rust + Tauri config
    src/lib.rs         # Main: lancia backend sidecar, gestisce lifecycle
    tauri.conf.json    # Config finestra, bundle, permissions
    bin/               # Backend bundlato (sidecar)
    icons/             # Icone app
  scripts/
    build-all.js       # Build frontend + bundle backend
    dev-backend.js     # Dev: lancia backend in watch mode
  frontend-dist/       # Frontend buildato (generato da build)
```

### Note

- Il backend gira su `localhost:43101` anche in modalita desktop
- Le API keys vanno configurate nel file `.env` nella cartella dati dell'app
- I modelli locali (Ollama, LM Studio) non sono inclusi — installarli separatamente

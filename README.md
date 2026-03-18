# Agent OS

Piattaforma visuale per orchestrare agenti IA multipli, multi-modello, locali e cloud.

## Panoramica

Agent OS è un sistema operativo per agenti IA dove puoi progettare, eseguire e monitorare workflow multi-agente tramite una mappa concettuale a nodi, con chat operativa integrata e gestione servizi/connettori.

## Stack Tecnologico

- **Backend**: Node.js, Express, TypeScript, SQLite (better-sqlite3)
- **Frontend**: React 18, Vite, TypeScript, Zustand, React Flow (@xyflow/react)
- **Database**: SQLite con WAL mode
- **UI**: Interfaccia in italiano, design professionale dark theme

## Requisiti

- Node.js >= 18
- npm >= 9
- macOS (supporto prioritario)

## Installazione

```bash
# Clona il progetto
cd AgenteOSBrain

# Installa dipendenze
npm install

# Configura le variabili d'ambiente (opzionale)
cp .env.example .env
# Modifica .env con le tue API key
```

## Avvio

```bash
# Avvia backend (porta 3001) + frontend (porta 5173)
npm run dev
```

Apri il browser su **http://localhost:5173**

### Avvio separato

```bash
# Solo backend
npm run dev:backend

# Solo frontend
npm run dev:frontend
```

## Configurazione Provider IA

Modifica il file `.env` nella root del progetto:

```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AI...
OLLAMA_BASE_URL=http://localhost:11434
```

Per usare Ollama in locale, assicurati che sia in esecuzione con almeno un modello installato.

## Architettura

```
AgenteOSBrain/
├── backend/          # Express API server
│   ├── src/
│   │   ├── database/     # SQLite + migrations
│   │   ├── modules/      # Projects, Graph, Agents, Providers, Chat, etc.
│   │   ├── orchestrator/ # Graph execution engine
│   │   └── middleware/   # Error handling
│   └── data/             # Runtime DB + outputs
├── frontend/         # React + Vite
│   └── src/
│       ├── components/   # Layout, Graph, Chat, Agents, etc.
│       ├── stores/       # Zustand state management
│       ├── api/          # Backend API client
│       └── i18n/         # Localizzazione italiana
└── shared/           # Tipi e costanti condivisi
```

## Funzionalità

### Pronte e funzionanti

- **Gestione Progetti**: crea, modifica, duplica, elimina con persistenza SQLite
- **Mappa a Nodi**: canvas visuale con 6 tipi nodo (Sorgente, Analisi, Decisione, Esecuzione, Memoria, Automazione), drag & drop, connessioni, auto-save
- **Multi-Agente**: crea agenti con nome, ruolo, provider, modello, system prompt, temperatura
- **Provider IA**: 4 provider configurati (OpenAI, Anthropic, Gemini, Ollama) con test connessione e fallback
- **Chat Copilot**: pannello chat laterale con contesto progetto, storico persistente
- **Automazioni**: creazione schedule (manuale, giornaliera, oraria, settimanale, cron), trigger manuale
- **Prompt di Sistema**: gestione prompt globali, per progetto e per nodo con editor dedicato
- **Catalogo Connettori**: 81 connettori in 12 categorie con ricerca e filtri
- **Output/Risultati**: visualizzatore output per progetto con dettaglio e eliminazione
- **Pannello Proprietà Nodo**: inspector laterale per modifica nodo selezionato

### Predisposti per sviluppo futuro

- Esecuzione automatica del grafo (orchestrator engine)
- Scheduling con cron attivo (node-cron integrato)
- Connettori runtime (webhook e REST API già con schema di configurazione)
- Chat NL-to-action (comandi in linguaggio naturale → operazioni sui nodi)
- Ingestion file locali (PDF, CSV, JSON, immagini)
- RAG locale con database vettoriale
- Export/import progetti
- Wrapper Electron per app nativa macOS
- Plugin system per nodi custom

## API Backend

Base URL: `http://localhost:3001/api/v1`

| Endpoint | Descrizione |
|----------|-------------|
| `GET/POST /projects` | Lista e creazione progetti |
| `GET/PUT/DELETE /projects/:id` | Dettaglio, modifica, elimina progetto |
| `GET/PUT /projects/:id/graph` | Carica/salva grafo completo |
| `POST /projects/:id/nodes` | Aggiungi nodo |
| `PUT/DELETE /nodes/:id` | Modifica/elimina nodo |
| `GET/POST /projects/:id/agents` | Lista e creazione agenti |
| `GET /providers` | Lista provider con stato e modelli |
| `GET/POST /projects/:id/chat` | Storico e invio messaggi chat |
| `GET/POST /prompts` | Gestione prompt |
| `GET /definitions` | Catalogo connettori (81) |
| `GET/POST /projects/:id/schedules` | Automazioni |
| `GET /projects/:id/outputs` | Risultati |

## Licenza

Progetto proprietario.

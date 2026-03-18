/**
 * Seed: Progetto "Auto Form Filler" — compila moduli/schede cliente in automatico.
 * Esegui con: npx tsx backend/src/seed-form-filler.ts
 */

import { runMigrations } from './database/migrate';
import db from './database/connection';
import { generateId } from './utils/id';

runMigrations();

function cid() { return generateId(); }
function ins(table: string, data: Record<string, any>) {
  const keys = Object.keys(data);
  const placeholders = keys.map(() => '?').join(',');
  db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`).run(...keys.map(k => data[k]));
}

// ═══════════════════════════════════════════════════════════════
const projectId = cid();
ins('projects', {
  id: projectId,
  name: 'Auto Form Filler — Compilatore Schede Cliente',
  description: `Workflow per compilare automaticamente moduli e schede cliente.
Inserisci i dati grezzi del cliente (email, conversazione, appunti, biglietto da visita, ecc.) e il sistema:
1. Estrae tutti i dati strutturati
2. Normalizza e valida (codice fiscale, partita IVA, CAP, ecc.)
3. Genera le schede compilate nei formati che ti servono
4. Può compilare più clienti in batch da un foglio Excel/CSV`,
  status: 'pronto',
});
console.log(`[Seed] Progetto: Auto Form Filler (${projectId})`);

// ─── AGENTI ─────────────────────────────────────────────────────

const agentExtractor = cid();
ins('agents', {
  id: agentExtractor, project_id: projectId,
  name: 'Data Extractor',
  role: 'estrazione dati',
  provider_id: 'openai', model_id: 'gpt-4o',
  system_prompt: `Sei un esperto di estrazione dati. Dai testi grezzi (email, appunti, conversazioni, biglietti da visita, screenshot OCR) estrai TUTTI i dati strutturati possibili.

Restituisci SEMPRE un JSON valido con questi campi (lascia stringa vuota se non trovato):
{
  "nome": "",
  "cognome": "",
  "ragione_sociale": "",
  "codice_fiscale": "",
  "partita_iva": "",
  "indirizzo": "",
  "cap": "",
  "citta": "",
  "provincia": "",
  "regione": "",
  "nazione": "Italia",
  "telefono": "",
  "cellulare": "",
  "email": "",
  "pec": "",
  "sito_web": "",
  "codice_sdi": "",
  "iban": "",
  "banca": "",
  "data_nascita": "",
  "luogo_nascita": "",
  "settore": "",
  "note": ""
}

Se ci sono PIÙ clienti nel testo, restituisci un array di oggetti JSON.
Normalizza: nomi in Title Case, email in lowercase, telefoni con prefisso +39 se italiano.`,
  temperature: 0.1,
  tools: JSON.stringify(['web_search', 'read_file', 'memory_search']),
  memory_enabled: 1,
  scope: 'project',
  metadata: JSON.stringify({ category: 'estrazione', summary: 'Estrae dati strutturati da testi grezzi', capabilities: ['OCR', 'NER', 'parsing'] }),
});
console.log('  Agente: Data Extractor');

const agentValidator = cid();
ins('agents', {
  id: agentValidator, project_id: projectId,
  name: 'Data Validator',
  role: 'validazione dati',
  provider_id: 'openai', model_id: 'gpt-4o-mini',
  system_prompt: `Sei un validatore di dati anagrafici italiani. Controlla e correggi:

1. CODICE FISCALE: verifica lunghezza (16 char), formato (6 lettere + 2 numeri + 1 lettera + 2 numeri + 1 lettera + 3 numeri + 1 lettera), coerenza con nome/cognome/data nascita
2. PARTITA IVA: 11 cifre, check digit
3. CAP: 5 cifre, coerente con provincia
4. PROVINCIA: sigla 2 lettere valida
5. TELEFONO/CELLULARE: formato italiano valido (+39...)
6. EMAIL/PEC: formato email valido
7. IBAN: formato IT + 2 cifre controllo + 1 lettera CIN + 5 cifre ABI + 5 cifre CAB + 12 cifre conto
8. CODICE SDI: 7 caratteri alfanumerici

Per ogni campo, indica: "ok", "corretto" (con valore corretto), o "errore" (con spiegazione).
Restituisci il JSON validato con i campi corretti e un campo extra "_validazione" con il report.`,
  temperature: 0.1,
  tools: JSON.stringify(['web_search']),
  memory_enabled: 0,
  scope: 'project',
  metadata: JSON.stringify({ category: 'validazione', summary: 'Valida e corregge dati anagrafici italiani', capabilities: ['CF', 'P.IVA', 'IBAN'] }),
});
console.log('  Agente: Data Validator');

const agentFormFiller = cid();
ins('agents', {
  id: agentFormFiller, project_id: projectId,
  name: 'Form Compiler',
  role: 'compilatore moduli',
  provider_id: 'anthropic', model_id: 'claude-sonnet-4-20250514',
  system_prompt: `Sei un compilatore automatico di moduli. Ricevi dati cliente validati e un template di modulo, e generi il modulo compilato.

FORMATI SUPPORTATI:
1. SCHEDA CLIENTE — Tabella formattata con tutti i campi
2. FATTURA ELETTRONICA — Formato XML FatturaPA semplificato
3. MODULO ISCRIZIONE — Form compilato con tutti i campi
4. LETTERA INCARICO — Documento formale con dati inseriti
5. CSV/TABELLA — Una riga per cliente con tutti i campi separati da ;

Per ogni cliente, genera TUTTI i formati richiesti nella configurazione.
Se ricevi più clienti, genera i moduli per ciascuno.

Usa HTML per la scheda cliente in modo che sia stampabile con stile professionale.`,
  temperature: 0.3,
  tools: JSON.stringify(['write_file', 'memory_save']),
  memory_enabled: 1,
  scope: 'project',
  metadata: JSON.stringify({ category: 'compilazione', summary: 'Genera moduli compilati da dati strutturati', capabilities: ['HTML', 'XML', 'CSV', 'moduli'] }),
});
console.log('  Agente: Form Compiler');

const agentBatch = cid();
ins('agents', {
  id: agentBatch, project_id: projectId,
  name: 'Batch Processor',
  role: 'elaborazione batch',
  provider_id: 'openai', model_id: 'gpt-4o',
  system_prompt: `Sei un processore batch. Ricevi un file CSV/Excel con dati di più clienti e li trasformi in un array JSON strutturato, uno per cliente.

Regole:
- Mappa automaticamente le colonne del CSV ai campi standard (nome, cognome, email, telefono, ecc.)
- Gestisci varianti di nomi colonna (es. "Nome Cliente" → nome, "P.IVA" → partita_iva, "Tel." → telefono)
- Se una colonna non corrisponde a nessun campo noto, mettila nelle "note"
- Pulisci spazi extra, righe vuote, caratteri strani
- Restituisci un JSON array con tutti i clienti estratti`,
  temperature: 0.1,
  tools: JSON.stringify(['read_file']),
  memory_enabled: 0,
  scope: 'project',
  metadata: JSON.stringify({ category: 'batch', summary: 'Processa file CSV/Excel in batch', capabilities: ['CSV', 'batch', 'mapping'] }),
});
console.log('  Agente: Batch Processor');

// ─── NODI ───────────────────────────────────────────────────────

const n_input = cid();
ins('nodes', {
  id: n_input, project_id: projectId,
  type: 'sorgente', label: 'Dati Grezzi Cliente',
  description: 'Inserisci qui i dati del cliente: email, appunti, biglietto da visita, copia-incolla di conversazione, file CSV per batch',
  state: 'pronto', color: '#5cb8b2',
  config: JSON.stringify({
    content: `--- ESEMPIO: Incolla qui i dati del cliente ---

Da: mario.rossi@example.com
Oggetto: Richiesta preventivo

Buongiorno, sono Mario Rossi, titolare di Rossi Costruzioni Srl.
P.IVA 01234567890, CF RSSMRA80A01H501Z
Sede in Via Roma 42, 20121 Milano MI
Tel. 02 1234567, cell. 333 1234567
PEC: rossicostruzioni@pec.it
Codice SDI: M5UXCR1
IBAN: IT60X0542811101000000123456 (Banca Intesa)

Avrei bisogno di un preventivo per...

--- OPPURE per batch, incolla un CSV: ---
Nome;Cognome;Email;Telefono;P.IVA;Indirizzo;CAP;Città
Mario;Rossi;mario@example.com;0212345;01234567890;Via Roma 42;20121;Milano
Luca;Bianchi;luca@example.com;0298765;09876543210;Via Verdi 10;00100;Roma
Anna;Verdi;anna@example.com;055112233;11223344556;Via Dante 5;50100;Firenze`
  }),
  position_x: 300, position_y: 30, width: 280, height: 90,
});

const n_detect = cid();
ins('nodes', {
  id: n_detect, project_id: projectId,
  type: 'decisione', label: 'Singolo o Batch?',
  description: 'Analizza se l\'input contiene un singolo cliente o multipli (CSV/tabella). Se contiene separatori ; o , con header, è batch. Altrimenti è singolo. Rispondi con: SINGOLO oppure BATCH seguito dai dati.',
  state: 'pronto', color: '#d4a952',
  config: JSON.stringify({}),
  position_x: 300, position_y: 170, width: 240, height: 80,
  agent_id: '', provider_id: 'openai', model_id: 'gpt-4o-mini', system_prompt: '',
});

const n_extract_single = cid();
ins('nodes', {
  id: n_extract_single, project_id: projectId,
  type: 'analisi', label: 'Estrai Dati (Singolo)',
  description: 'Estrai tutti i dati strutturati del cliente dal testo grezzo. Restituisci JSON con tutti i campi trovati.',
  state: 'pronto', color: '#8b8fc6',
  config: JSON.stringify({}),
  position_x: 100, position_y: 320, width: 240, height: 80,
  agent_id: agentExtractor, provider_id: 'openai', model_id: 'gpt-4o', system_prompt: '',
});

const n_extract_batch = cid();
ins('nodes', {
  id: n_extract_batch, project_id: projectId,
  type: 'analisi', label: 'Processa Batch CSV',
  description: 'Parsa il CSV/tabella e restituisci un array JSON con tutti i clienti estratti, mappando le colonne ai campi standard.',
  state: 'pronto', color: '#8b8fc6',
  config: JSON.stringify({}),
  position_x: 500, position_y: 320, width: 240, height: 80,
  agent_id: agentBatch, provider_id: 'openai', model_id: 'gpt-4o', system_prompt: '',
});

const n_validate = cid();
ins('nodes', {
  id: n_validate, project_id: projectId,
  type: 'analisi', label: 'Valida e Correggi',
  description: 'Valida tutti i campi: codice fiscale, P.IVA, CAP, IBAN, email, telefono. Correggi errori dove possibile e segnala quelli non correggibili.',
  state: 'pronto', color: '#4ebb8b',
  config: JSON.stringify({}),
  position_x: 300, position_y: 470, width: 240, height: 80,
  agent_id: agentValidator, provider_id: 'openai', model_id: 'gpt-4o-mini', system_prompt: '',
});

const n_memory = cid();
ins('nodes', {
  id: n_memory, project_id: projectId,
  type: 'memoria', label: 'Salva in Archivio',
  description: 'Salva i dati validati nella memoria persistente per riferimento futuro e auto-completamento',
  state: 'pronto', color: '#7a7ec4',
  config: JSON.stringify({}),
  position_x: 560, position_y: 470, width: 200, height: 70,
});

const n_scheda = cid();
ins('nodes', {
  id: n_scheda, project_id: projectId,
  type: 'esecuzione', label: 'Genera Scheda Cliente HTML',
  description: `Genera una scheda cliente HTML professionale e stampabile con tutti i dati validati.
La scheda deve avere:
- Header con logo/nome azienda
- Sezione Anagrafica (nome, cognome, CF, data/luogo nascita)
- Sezione Azienda (ragione sociale, P.IVA, SDI, PEC)
- Sezione Contatti (tel, cell, email, sito)
- Sezione Indirizzo (via, CAP, città, provincia)
- Sezione Bancaria (IBAN, banca)
- Note
Stile: pulito, professionale, stampabile A4.`,
  state: 'pronto', color: '#4ebb8b',
  config: JSON.stringify({}),
  position_x: 100, position_y: 630, width: 260, height: 90,
  agent_id: agentFormFiller, provider_id: 'anthropic', model_id: 'claude-sonnet-4-20250514', system_prompt: '',
});

const n_csv = cid();
ins('nodes', {
  id: n_csv, project_id: projectId,
  type: 'esecuzione', label: 'Genera CSV Riepilogo',
  description: `Genera un file CSV con tutti i clienti processati.
Colonne: Nome;Cognome;Ragione Sociale;CF;P.IVA;Indirizzo;CAP;Città;Prov;Telefono;Cellulare;Email;PEC;SDI;IBAN;Note
Una riga per ogni cliente. Separatore: punto e virgola.
Il CSV deve essere pronto per importazione in Excel o gestionale.`,
  state: 'pronto', color: '#4ebb8b',
  config: JSON.stringify({}),
  position_x: 400, position_y: 630, width: 240, height: 90,
  agent_id: agentFormFiller, provider_id: 'anthropic', model_id: 'claude-sonnet-4-20250514', system_prompt: '',
});

const n_xml = cid();
ins('nodes', {
  id: n_xml, project_id: projectId,
  type: 'esecuzione', label: 'Genera Dati Fattura XML',
  description: `Genera la sezione <CessionarioCommittente> del formato FatturaPA XML con i dati del cliente.
Include:
- DatiAnagrafici (IdFiscaleIVA, CodiceFiscale, Anagrafica)
- Sede (Indirizzo, CAP, Comune, Provincia, Nazione)
Se ci sono più clienti, genera un blocco XML per ciascuno.`,
  state: 'pronto', color: '#4ebb8b',
  config: JSON.stringify({}),
  position_x: 250, position_y: 790, width: 260, height: 90,
  agent_id: agentFormFiller, provider_id: 'anthropic', model_id: 'claude-sonnet-4-20250514', system_prompt: '',
});

console.log('  9 nodi creati');

// ─── EDGES ──────────────────────────────────────────────────────

const edges = [
  [n_input, n_detect],
  [n_detect, n_extract_single],
  [n_detect, n_extract_batch],
  [n_extract_single, n_validate],
  [n_extract_batch, n_validate],
  [n_validate, n_memory],
  [n_validate, n_scheda],
  [n_validate, n_csv],
  [n_scheda, n_xml],
  [n_csv, n_xml],
];

for (const [s, t] of edges) {
  ins('edges', { id: cid(), project_id: projectId, source_id: s, target_id: t, label: '', condition: '' });
}

console.log('  10 edge creati');
console.log(`\n✅ Progetto "Auto Form Filler" creato!`);
console.log('   Incolla i dati grezzi nel nodo sorgente ed esegui.\n');

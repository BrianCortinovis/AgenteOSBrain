/**
 * Seed: 3 progetti editoriali + agenti globali di sistema
 * npx tsx backend/src/seed-editorial.ts
 */
import { runMigrations } from './database/migrate';
import db from './database/connection';
import { generateId } from './utils/id';

runMigrations();

const id = () => generateId();
function ins(t: string, d: Record<string, any>) {
  const k = Object.keys(d);
  db.prepare(`INSERT INTO ${t} (${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`).run(...k.map(x => d[x]));
}
function agent(pid: string, d: any) {
  const aid = id();
  ins('agents', {
    id: aid, project_id: pid, name: d.name, role: d.role || '', scope: d.scope || 'project',
    provider_id: d.provider || 'openai', model_id: d.model || 'gpt-4o',
    system_prompt: d.prompt || '', temperature: d.temp ?? 0.5,
    tools: JSON.stringify(d.tools || []), memory_enabled: d.memory ? 1 : 0,
    metadata: JSON.stringify({ category: d.role || 'generalista', summary: d.prompt?.slice(0, 100) || '', capabilities: d.tools || [] }),
  });
  return aid;
}
function node(pid: string, d: any) {
  const nid = id();
  ins('nodes', {
    id: nid, project_id: pid, type: d.type, label: d.label, description: d.desc || '',
    state: 'pronto', color: d.color || '', config: JSON.stringify(d.config || {}),
    position_x: d.x, position_y: d.y, width: d.w || 260, height: 80,
    agent_id: d.agent || null, provider_id: d.prov || '', model_id: d.mod || '',
    system_prompt: d.sp || '',
  });
  return nid;
}
function edge(pid: string, s: string, t: string) {
  ins('edges', { id: id(), project_id: pid, source_id: s, target_id: t, label: '', condition: '' });
}

// ═══════════════════════════════════════════════════════════════
//  AGENTI GLOBALI DI SISTEMA
// ═══════════════════════════════════════════════════════════════
const GP = '__global_agents__';
console.log('\n[Seed] Agenti globali di sistema...');

agent(GP, {
  name: 'Traduttore Universale', role: 'traduzione', scope: 'global',
  provider: 'openai', model: 'gpt-4o',
  prompt: `Sei un traduttore professionista multilingua. Traduci qualsiasi testo mantenendo:
- Tono e registro originale
- Terminologia tecnica di settore
- Formattazione (titoli, elenchi, tabelle)
- Senso e sfumature culturali

Se non viene specificata la lingua di destinazione, traduci in italiano.
Se il testo è già in italiano, traduci in inglese.
Indica sempre: [Lingua origine → Lingua destinazione] in cima.`,
  tools: ['memory_save'], memory: true, temp: 0.3,
});
console.log('  Traduttore Universale');

agent(GP, {
  name: 'Email Composer', role: 'email', scope: 'global',
  provider: 'openai', model: 'gpt-4o',
  prompt: `Sei un esperto di comunicazione email professionale. Genera email complete con:
- Oggetto (max 60 char, chiaro e specifico)
- Corpo strutturato: apertura → contesto → richiesta/info → chiusura → firma
- Tono adattabile: formale, semi-formale, cordiale
- Varianti per: sollecito, ringraziamento, proposta, scuse, conferma, follow-up
Se ricevi solo appunti o bullet point, trasformali in email professionali.`,
  tools: ['connector_action', 'memory_search'], memory: true, temp: 0.5,
});
console.log('  Email Composer');

agent(GP, {
  name: 'WhatsApp Business Bot', role: 'messaggistica', scope: 'global',
  provider: 'openai', model: 'gpt-4o-mini',
  prompt: `Sei un assistente per messaggi WhatsApp Business. Genera risposte:
- Brevi e dirette (max 300 char per messaggio)
- Tono professionale ma amichevole
- Con emoji appropriate ma non eccessive
- Formattazione WhatsApp: *grassetto*, _corsivo_, ~barrato~
Tipi: risposta cliente, conferma appuntamento, promemoria, preventivo rapido, FAQ.`,
  tools: ['connector_action', 'memory_search'], memory: true, temp: 0.6,
});
console.log('  WhatsApp Business Bot');

agent(GP, {
  name: 'Sintetizzatore Documenti', role: 'analisi documentale', scope: 'global',
  provider: 'anthropic', model: 'claude-sonnet-4-20250514',
  prompt: `Sei un analista documentale esperto. Leggi documenti lunghi e produci:
- RIASSUNTO ESECUTIVO (3-5 righe, per decisori)
- PUNTI CHIAVE (bullet point, max 10)
- DATI E CIFRE (tabella con tutti i numeri/date/importi trovati)
- AZIONI RICHIESTE (se presenti nel documento)
- CRITICITÀ (problemi, rischi, scadenze vicine)
Mantieni i riferimenti a pagine/sezioni. Sii preciso sui dati numerici.`,
  tools: ['read_file', 'memory_save', 'memory_search'], memory: true, temp: 0.2,
});
console.log('  Sintetizzatore Documenti');

agent(GP, {
  name: 'Correttore Bozze', role: 'editing', scope: 'global',
  provider: 'anthropic', model: 'claude-sonnet-4-20250514',
  prompt: `Sei un editor e correttore di bozze professionista italiano. Controlla:
- Ortografia e grammatica
- Punteggiatura e spaziature
- Coerenza stilistica e di registro
- Ripetizioni e ridondanze
- Chiarezza e leggibilità
Restituisci il testo corretto + una lista delle correzioni effettuate con spiegazione.
NON cambiare il significato. Segnala passaggi ambigui senza riscriverli.`,
  tools: ['memory_save'], memory: false, temp: 0.1,
});
console.log('  Correttore Bozze');

agent(GP, {
  name: 'Calendario & Scadenze', role: 'organizzazione', scope: 'global',
  provider: 'openai', model: 'gpt-4o-mini',
  prompt: `Sei un assistente per la gestione di scadenze e appuntamenti. Da qualsiasi testo (email, note, documenti):
- Estrai TUTTE le date, scadenze e appuntamenti
- Formato: DATA | ORA | COSA | CHI | PRIORITÀ
- Calcola giorni mancanti da oggi
- Segnala scadenze entro 7 giorni come URGENTI
- Ordina per data crescente
Rispondi sempre con una tabella ordinata.`,
  tools: ['memory_save', 'memory_search'], memory: true, temp: 0.1,
});
console.log('  Calendario & Scadenze');

agent(GP, {
  name: 'Generatore Report', role: 'reportistica', scope: 'global',
  provider: 'openai', model: 'gpt-4o',
  prompt: `Sei un generatore di report professionali. Trasformi dati grezzi in documenti strutturati:
- REPORT SINTETICO: 1 pagina, executive summary + 5 bullet + conclusione
- REPORT STANDARD: 3-5 pagine con sezioni, grafici testuali, tabelle
- REPORT DETTAGLIATO: completo con appendici, metodologia, dati disaggregati
Adatta il formato alla richiesta. Usa HTML per formattazione stampabile quando richiesto.`,
  tools: ['write_file', 'memory_search'], memory: true, temp: 0.4,
});
console.log('  Generatore Report');

agent(GP, {
  name: 'Estrattore Dati PDF', role: 'OCR e parsing', scope: 'global',
  provider: 'gemini', model: 'gemini-2.5-flash',
  prompt: `Sei un estrattore di dati da documenti. Dai PDF, scansioni e immagini:
- Estrai TUTTO il testo leggibile
- Identifica tabelle e preserva la struttura
- Riconosci campi modulo compilati
- Estrai firme, timbri, date, protocolli
- Per fatture: numero, data, importi, P.IVA, destinatario
- Per contratti: parti, oggetto, durata, importo, clausole chiave
Restituisci dati strutturati in JSON quando possibile.`,
  tools: ['read_file', 'memory_save'], memory: true, temp: 0.1,
});
console.log('  Estrattore Dati PDF');

// ═══════════════════════════════════════════════════════════════
//  EDITORIALE_1: Analisi e Resoconto Documenti
// ═══════════════════════════════════════════════════════════════
console.log('\n[Seed] Editoriale_1: Analisi e Resoconto Documenti...');
const p1 = id();
ins('projects', { id: p1, name: 'Editoriale_1 — Analisi e Resoconto Documenti',
  description: `Analizza documenti (PDF, scansioni, testi) e genera resoconti in diversi formati.

Cosa fa:
1. Carica un documento o incolla del testo
2. Estrae dati, cifre, date e informazioni chiave
3. Genera 3 versioni del resoconto: sintetico, medio, dettagliato
4. Salva tutto in memoria per riferimenti futuri

Come usarlo: Inserisci il percorso del file o incolla il testo nel nodo sorgente e premi Play.`, status: 'pronto' });

const a1_ext = agent(p1, { name: 'Lettore Documenti', role: 'parsing', provider: 'gemini', model: 'gemini-2.5-flash',
  prompt: 'Leggi il documento fornito ed estrai: testo completo, struttura (titoli, paragrafi, tabelle), dati numerici, date, nomi, riferimenti normativi. Preserva la formattazione originale il più possibile.',
  tools: ['read_file'], temp: 0.1 });
const a1_syn = agent(p1, { name: 'Analista Editoriale', role: 'analisi', provider: 'anthropic', model: 'claude-sonnet-4-20250514',
  prompt: 'Sei un analista editoriale senior. Analizza documenti e produci riassunti accurati, identifica temi principali, argomenti chiave, tesi sostenute e conclusioni. Mantieni rigore e imparzialità.',
  tools: ['memory_save', 'memory_search'], memory: true, temp: 0.3 });
const a1_rep = agent(p1, { name: 'Redattore Report', role: 'redazione', provider: 'openai', model: 'gpt-4o',
  prompt: 'Sei un redattore professionista. Trasforma analisi in report leggibili con struttura chiara, linguaggio accessibile e formattazione professionale.',
  tools: ['write_file'], temp: 0.4 });

const n1_src = node(p1, { type: 'sorgente', label: 'Documento in Input', x: 350, y: 40, color: '#5cb8b2',
  desc: 'Inserisci il percorso del file o incolla il contenuto del documento da analizzare',
  config: { content: 'Incolla qui il testo del documento da analizzare oppure inserisci il percorso del file:\n\n/percorso/al/documento.pdf\n\nSupporta: PDF, TXT, documenti scannerizzati (via Gemini Vision), testi incollati.' } });

const n1_read = node(p1, { type: 'analisi', label: 'Lettura e Estrazione', x: 350, y: 280, color: '#8b8fc6',
  desc: 'Legge il documento ed estrae testo, struttura, dati numerici, date, riferimenti', agent: a1_ext, prov: 'gemini', mod: 'gemini-2.5-flash' });

const n1_analyze = node(p1, { type: 'analisi', label: 'Analisi Contenuto', x: 350, y: 520, color: '#8b8fc6',
  desc: 'Analizza il contenuto: temi principali, argomenti, dati chiave, criticità, scadenze', agent: a1_syn, prov: 'anthropic', mod: 'claude-sonnet-4-20250514' });

const n1_short = node(p1, { type: 'esecuzione', label: 'Resoconto Sintetico', x: 50, y: 780, color: '#4ebb8b',
  desc: 'Genera resoconto SINTETICO: max 10 righe, solo i punti essenziali per chi ha 1 minuto di tempo', agent: a1_rep, prov: 'openai', mod: 'gpt-4o' });

const n1_mid = node(p1, { type: 'esecuzione', label: 'Resoconto Medio', x: 350, y: 780, color: '#4ebb8b',
  desc: 'Genera resoconto MEDIO: 1-2 pagine con executive summary, punti chiave, dati rilevanti, conclusioni', agent: a1_rep, prov: 'openai', mod: 'gpt-4o' });

const n1_long = node(p1, { type: 'esecuzione', label: 'Resoconto Dettagliato', x: 650, y: 780, color: '#4ebb8b',
  desc: 'Genera resoconto DETTAGLIATO: report completo con tutte le sezioni, tabelle dati, citazioni, appendice note', agent: a1_rep, prov: 'openai', mod: 'gpt-4o' });

const n1_mem = node(p1, { type: 'memoria', label: 'Archivio Analisi', x: 650, y: 520, color: '#7a7ec4',
  desc: 'Salva analisi in memoria per riferimenti incrociati tra documenti' });

edge(p1, n1_src, n1_read); edge(p1, n1_read, n1_analyze);
edge(p1, n1_analyze, n1_short); edge(p1, n1_analyze, n1_mid); edge(p1, n1_analyze, n1_long);
edge(p1, n1_analyze, n1_mem);
console.log('  7 nodi, 6 edge');

// ═══════════════════════════════════════════════════════════════
//  EDITORIALE_2: Batch Analisi PDF + Confronto
// ═══════════════════════════════════════════════════════════════
console.log('\n[Seed] Editoriale_2: Batch Analisi PDF e Confronto...');
const p2 = id();
ins('projects', { id: p2, name: 'Editoriale_2 — Batch PDF: Analisi e Confronto',
  description: `Analizza più documenti PDF in batch, confrontali e genera un report comparativo.

Cosa fa:
1. Carica una cartella con più PDF/documenti
2. Analizza ciascuno estraendo dati e contenuti chiave
3. Confronta i documenti tra loro (differenze, sovrapposizioni, contraddizioni)
4. Genera report comparativo + tabella sinottica

Come usarlo: Inserisci il percorso della cartella nel nodo sorgente e premi Play.`, status: 'pronto' });

const a2_batch = agent(p2, { name: 'Batch Reader', role: 'lettura batch', provider: 'gemini', model: 'gemini-2.5-flash',
  prompt: 'Leggi tutti i file dalla cartella fornita. Per ciascuno estrai: nome file, tipo, contenuto principale, dati numerici, date, autore. Restituisci un JSON array con un oggetto per file.',
  tools: ['read_file'], temp: 0.1 });
const a2_comp = agent(p2, { name: 'Comparatore', role: 'confronto', provider: 'anthropic', model: 'claude-sonnet-4-20250514',
  prompt: 'Sei un analista comparativo. Confronta più documenti e identifica: punti in comune, differenze significative, contraddizioni, evoluzione temporale, dati discordanti. Usa tabelle comparative.',
  tools: ['memory_save'], memory: true, temp: 0.2 });

const n2_src = node(p2, { type: 'sorgente', label: 'Cartella Documenti', x: 350, y: 40, color: '#5cb8b2',
  desc: 'Percorso della cartella con i PDF/documenti da analizzare in batch',
  config: { content: '/percorso/alla/cartella/documenti\n\nSupporta: PDF, TXT, DOC. Tutti i file nella cartella verranno analizzati.' } });

const n2_scan = node(p2, { type: 'analisi', label: 'Scansione Batch', x: 350, y: 280, color: '#8b8fc6',
  desc: 'Legge tutti i documenti dalla cartella e ne estrae i contenuti', agent: a2_batch, prov: 'gemini', mod: 'gemini-2.5-flash' });

const n2_each = node(p2, { type: 'analisi', label: 'Analisi Singoli', x: 100, y: 520, color: '#8b8fc6',
  desc: 'Per ogni documento: riassunto, dati chiave, date, importi, soggetti menzionati', agent: a2_comp, prov: 'anthropic', mod: 'claude-sonnet-4-20250514' });

const n2_compare = node(p2, { type: 'decisione', label: 'Confronto Documenti', x: 600, y: 520, color: '#d4a952',
  desc: 'Confronta tutti i documenti: differenze, sovrapposizioni, contraddizioni, timeline', agent: a2_comp, prov: 'anthropic', mod: 'claude-sonnet-4-20250514' });

const n2_table = node(p2, { type: 'esecuzione', label: 'Tabella Sinottica', x: 100, y: 780, color: '#4ebb8b',
  desc: 'Genera una tabella sinottica CSV con una riga per documento e colonne per i campi chiave estratti', prov: 'openai', mod: 'gpt-4o' });

const n2_report = node(p2, { type: 'esecuzione', label: 'Report Comparativo', x: 600, y: 780, color: '#4ebb8b',
  desc: 'Genera report comparativo HTML: executive summary, analisi per documento, matrice confronto, conclusioni', prov: 'openai', mod: 'gpt-4o',
  sp: 'Genera un report HTML professionale e stampabile con header, sezioni numerate, tabelle comparative e conclusioni.' });

edge(p2, n2_src, n2_scan); edge(p2, n2_scan, n2_each); edge(p2, n2_scan, n2_compare);
edge(p2, n2_each, n2_compare); edge(p2, n2_each, n2_table);
edge(p2, n2_compare, n2_report);
console.log('  6 nodi, 6 edge');

// ═══════════════════════════════════════════════════════════════
//  EDITORIALE_3: Revisione Editoriale Completa
// ═══════════════════════════════════════════════════════════════
console.log('\n[Seed] Editoriale_3: Revisione Editoriale Completa...');
const p3 = id();
ins('projects', { id: p3, name: 'Editoriale_3 — Revisione e Impaginazione',
  description: `Pipeline completa di revisione editoriale: correzione bozze, editing stilistico, traduzione e impaginazione.

Cosa fa:
1. Riceve un testo/manoscritto in qualsiasi lingua
2. Corregge errori ortografici, grammaticali e di stile
3. Traduce in italiano e inglese
4. Genera versione impaginata HTML pronta per stampa
5. Produce scheda editoriale con metadati

Come usarlo: Incolla il testo da revisionare nel nodo sorgente e premi Play.`, status: 'pronto' });

const a3_corr = agent(p3, { name: 'Correttore', role: 'correzione', provider: 'anthropic', model: 'claude-sonnet-4-20250514',
  prompt: 'Correggi il testo: ortografia, grammatica, punteggiatura, ripetizioni, coerenza. Restituisci il testo corretto + lista correzioni con spiegazioni. Non cambiare il significato.',
  temp: 0.1 });
const a3_edit = agent(p3, { name: 'Editor Stilistico', role: 'editing', provider: 'anthropic', model: 'claude-sonnet-4-20250514',
  prompt: 'Migliora lo stile del testo: fluidità, ritmo, chiarezza, eliminazione ridondanze. Mantieni la voce dell\'autore. Suggerisci riformulazioni per passaggi deboli. Non stravolgere.',
  temp: 0.3 });
const a3_trad = agent(p3, { name: 'Traduttore IT/EN', role: 'traduzione', provider: 'openai', model: 'gpt-4o',
  prompt: 'Traduci il testo mantenendo stile, registro e terminologia. Adatta riferimenti culturali. Per testi letterari, preserva figure retoriche e ritmo.',
  temp: 0.3 });
const a3_layout = agent(p3, { name: 'Impaginatore', role: 'impaginazione', provider: 'openai', model: 'gpt-4o',
  prompt: 'Genera una versione HTML impaginata professionalmente del testo: font serif leggibile (Georgia/Garamond), margini ampi, intestazioni, numerazione pagine, note a piè di pagina. Stile editoriale classico, pronta per stampa A4.',
  tools: ['write_file'], temp: 0.3 });

const n3_src = node(p3, { type: 'sorgente', label: 'Manoscritto / Testo', x: 350, y: 40, color: '#5cb8b2',
  desc: 'Incolla il testo o manoscritto da revisionare',
  config: { content: 'Incolla qui il testo da revisionare.\n\nPuò essere: articolo, capitolo libro, comunicato stampa, relazione, tesi, contratto...' } });

const n3_corr = node(p3, { type: 'analisi', label: 'Correzione Bozze', x: 350, y: 280, color: '#8b8fc6',
  desc: 'Corregge errori ortografici, grammaticali e di punteggiatura', agent: a3_corr, prov: 'anthropic', mod: 'claude-sonnet-4-20250514' });

const n3_edit = node(p3, { type: 'analisi', label: 'Editing Stilistico', x: 350, y: 520, color: '#8b8fc6',
  desc: 'Migliora stile, fluidità e chiarezza mantenendo la voce dell\'autore', agent: a3_edit, prov: 'anthropic', mod: 'claude-sonnet-4-20250514' });

const n3_it = node(p3, { type: 'esecuzione', label: 'Versione Italiana', x: 50, y: 780, color: '#4ebb8b',
  desc: 'Se il testo non è in italiano, traducilo. Se già italiano, ottimizza per pubblicazione.', agent: a3_trad, prov: 'openai', mod: 'gpt-4o' });

const n3_en = node(p3, { type: 'esecuzione', label: 'Versione Inglese', x: 350, y: 780, color: '#4ebb8b',
  desc: 'Traduci in inglese professionale mantenendo stile e registro', agent: a3_trad, prov: 'openai', mod: 'gpt-4o' });

const n3_layout = node(p3, { type: 'esecuzione', label: 'HTML Impaginato', x: 650, y: 780, color: '#4ebb8b',
  desc: 'Genera versione HTML impaginata con stile editoriale classico, pronta per stampa', agent: a3_layout, prov: 'openai', mod: 'gpt-4o' });

const n3_scheda = node(p3, { type: 'esecuzione', label: 'Scheda Editoriale', x: 350, y: 1040, color: '#4ebb8b',
  desc: 'Genera scheda editoriale: titolo, autore, genere, lunghezza, lingua, abstract 200 parole, keyword, target, note editor', prov: 'openai', mod: 'gpt-4o-mini' });

edge(p3, n3_src, n3_corr); edge(p3, n3_corr, n3_edit);
edge(p3, n3_edit, n3_it); edge(p3, n3_edit, n3_en); edge(p3, n3_edit, n3_layout);
edge(p3, n3_it, n3_scheda); edge(p3, n3_en, n3_scheda); edge(p3, n3_layout, n3_scheda);
console.log('  7 nodi, 8 edge');

// ═══════════════════════════════════════════════════════════════
console.log('\n✅ Seed editoriale completato!');
console.log('   - 8 agenti globali di sistema');
console.log('   - Editoriale_1: Analisi e Resoconto (3 formati)');
console.log('   - Editoriale_2: Batch PDF e Confronto');
console.log('   - Editoriale_3: Revisione e Impaginazione\n');

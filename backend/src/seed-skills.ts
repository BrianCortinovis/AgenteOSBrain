/**
 * Seed: Libreria completa di Skills per lavoro, documenti, siti, codice
 * npx tsx backend/src/seed-skills.ts
 */
import { runMigrations } from './database/migrate';
import db from './database/connection';
import { generateId } from './utils/id';

runMigrations();

function skill(name: string, desc: string, cat: string, content: string) {
  db.prepare(
    `INSERT OR REPLACE INTO skills (id, name, description, category, content, enabled) VALUES (?, ?, ?, ?, ?, 1)`
  ).run(generateId(), name, desc, cat, content);
  console.log(`  [${cat}] ${name}`);
}

// ═══════════════════════════════════════════════════════════════
//  DOCUMENTI & ANALISI
// ═══════════════════════════════════════════════════════════════
console.log('\n[Skills] Documenti & Analisi...');

skill('analisi-contratto', 'Analizza contratti e identifica clausole chiave, rischi e obblighi', 'documenti',
`Analizza il contratto fornito ed estrai:
1. PARTI COINVOLTE: chi firma, ruoli, rappresentanti
2. OGGETTO: cosa viene concordato
3. DURATA: inizio, fine, rinnovo automatico, recesso
4. CORRISPETTIVO: importi, modalità pagamento, scadenze
5. OBBLIGHI: per ciascuna parte
6. CLAUSOLE CRITICHE: penali, riservatezza, non concorrenza, foro competente
7. RISCHI: clausole ambigue, svantaggiose, mancanti
8. SCADENZE: tutte le date con giorni mancanti
Formato output: tabella strutturata per sezione.`);

skill('analisi-fattura', 'Estrae dati da fatture italiane (cartacee e XML)', 'documenti',
`Estrai da fattura italiana:
- Numero fattura, data emissione, data scadenza
- Cedente: ragione sociale, P.IVA, CF, indirizzo, SDI
- Cessionario: ragione sociale, P.IVA, CF, indirizzo
- Righe: descrizione, quantità, prezzo unitario, IVA%, importo
- Totali: imponibile, IVA, totale documento
- Pagamento: modalità, IBAN, scadenza
- Note e causale
Restituisci in formato JSON strutturato.`);

skill('verbale-riunione', 'Genera verbali di riunione strutturati da appunti', 'documenti',
`Trasforma gli appunti in un verbale di riunione professionale:
INTESTAZIONE: data, ora, luogo, presenti, assenti, ordine del giorno
PER OGNI PUNTO ALL'ODG:
- Discussione: sintesi degli interventi
- Decisioni: cosa è stato deciso
- Azioni: chi fa cosa, entro quando
CHIUSURA: prossima riunione, firma segretario
Tono: formale, impersonale, terza persona.`);

skill('lettera-formale', 'Genera lettere formali italiane (diffide, richieste, comunicazioni)', 'documenti',
`Genera lettere formali italiane con:
- Intestazione: mittente completo (nome, indirizzo, CF/P.IVA)
- Destinatario: completo con titolo
- Riferimenti: Oggetto, Rif. precedenti, data
- Corpo: apertura formale, esposizione fatti, richiesta/comunicazione, termine
- Chiusura: formula di cortesia, firma, allegati
Tono: formale-giuridico per diffide, formale-cortese per richieste.`);

skill('riassunto-esecutivo', 'Genera executive summary da documenti lunghi', 'documenti',
`Genera un Executive Summary professionale:
- MAX 1 PAGINA (300-400 parole)
- Primo paragrafo: contesto e scopo in 2 righe
- Findings chiave: 3-5 bullet point con dati concreti
- Implicazioni: cosa significa per il business
- Raccomandazione: azione suggerita con priorità
- Timeline: prossimi passi con date
Linguaggio: diretto, orientato alle decisioni, zero filler.`);

skill('confronto-documenti', 'Confronta due o più documenti evidenziando differenze', 'documenti',
`Confronta i documenti forniti e genera:
MATRICE DIFFERENZE:
| Sezione | Doc A | Doc B | Differenza |
Per ogni differenza indica: AGGIUNTA, RIMOSSA, MODIFICATA
ANALISI:
- Differenze sostanziali vs formali
- Contraddizioni tra documenti
- Elementi presenti solo in uno
- Evoluzione temporale se datati
Output: tabella comparativa + commento analitico.`);

// ═══════════════════════════════════════════════════════════════
//  ANALISI SITI WEB
// ═══════════════════════════════════════════════════════════════
console.log('[Skills] Analisi Siti Web...');

skill('audit-seo', 'Audit SEO completo di un sito web', 'siti-web',
`Esegui un audit SEO completo:
TECNICO: velocità stimata, mobile-friendly, HTTPS, sitemap, robots.txt
ON-PAGE: title tag, meta description, heading structure H1-H6, alt images
CONTENUTI: keyword density, qualità testi, lunghezza pagine, contenuti duplicati
LINK: struttura link interni, broken links potenziali, anchor text
LOCAL SEO: NAP consistency, Google Business Profile
Punteggio: 0-100 per sezione + punteggio globale
Output: tabella con issue, severità (alta/media/bassa), azione correttiva.`);

skill('audit-ux', 'Valutazione UX/UI di un sito o app', 'siti-web',
`Valuta l'esperienza utente:
NAVIGAZIONE: menu, breadcrumb, search, struttura informativa
LAYOUT: gerarchia visiva, whitespace, responsive design
CTA: visibilità, chiarezza, posizionamento
FORM: usabilità, validazione, feedback
ACCESSIBILITÀ: contrasti, font size, alt text, keyboard nav
PERFORMANCE PERCEPITA: loading, feedback visivo, transizioni
Per ogni area: punteggio 1-5, problema specifico, soluzione suggerita.`);

skill('analisi-competitor-web', 'Analizza siti competitor e genera benchmark', 'siti-web',
`Per ogni competitor analizza:
- Proposta di valore (above the fold)
- Struttura pagine principali
- Strategia contenuti (blog, risorse, case study)
- Stack tecnologico stimato
- Punti di forza e debolezza
BENCHMARK: tabella comparativa su 10 criteri con punteggio 1-5
OPPORTUNITÀ: gap sfruttabili, differenziazione possibile.`);

skill('copy-landing-page', 'Genera copy per landing page con struttura persuasiva', 'siti-web',
`Genera copy per landing page con struttura:
1. HERO: headline (max 10 parole), sub-headline, CTA primaria
2. PROBLEMA: 3 pain point del target
3. SOLUZIONE: come il prodotto/servizio risolve
4. BENEFICI: 3-4 con icona suggerita
5. SOCIAL PROOF: struttura per testimonianze
6. COME FUNZIONA: 3 step
7. PRICING: struttura tabella piani
8. FAQ: 5 domande frequenti
9. CTA FINALE: urgenza + beneficio
Tono adattabile: B2B formale, B2C friendly, startup bold.`);

// ═══════════════════════════════════════════════════════════════
//  CODICE & SVILUPPO
// ═══════════════════════════════════════════════════════════════
console.log('[Skills] Codice & Sviluppo...');

skill('code-review', 'Revisione codice con best practice e security', 'codice',
`Revisiona il codice fornito controllando:
QUALITÀ: naming, struttura, DRY, SOLID, complessità ciclomatica
SICUREZZA: injection, XSS, CSRF, auth/authz, secrets esposti, OWASP Top 10
PERFORMANCE: N+1 queries, memory leaks, operazioni O(n²), caching
MANUTENIBILITÀ: test coverage stimata, documentazione, error handling
Per ogni issue: file:linea, severità, descrizione, fix suggerito.
Output: tabella ordinata per severità.`);

skill('genera-api-docs', 'Genera documentazione API da codice sorgente', 'codice',
`Analizza il codice e genera documentazione API:
Per ogni endpoint:
- METHOD URL
- Descrizione: cosa fa
- Headers richiesti
- Body: JSON schema con tipi e required
- Response: status codes + JSON schema risposta
- Esempio request/response
- Errori possibili
Formato: Markdown strutturato pronto per docs site.`);

skill('refactoring-plan', 'Analizza codice legacy e propone piano di refactoring', 'codice',
`Analizza il codice e proponi un piano di refactoring:
1. CODE SMELLS: lista con posizione e tipo
2. DEBITO TECNICO: stima effort per area (ore)
3. PRIORITÀ: cosa refactorare prima (impatto/effort)
4. PIANO: step-by-step con dipendenze
5. RISCHI: cosa può rompersi, test necessari
6. ARCHITETTURA TARGET: come dovrebbe essere dopo
Non riscrivere tutto — proponi modifiche incrementali e sicure.`);

skill('genera-test', 'Genera test unitari e di integrazione per codice esistente', 'codice',
`Genera test per il codice fornito:
- TEST UNITARI: per ogni funzione pubblica, happy path + edge cases + errori
- TEST INTEGRAZIONE: per flussi end-to-end critici
- MOCKING: identifica dipendenze esterne da mockare
- FIXTURES: dati di test realistici
Framework: adatta al linguaggio (Jest per JS/TS, pytest per Python, etc.)
Nomina: describe/it con descrizioni chiare in italiano o inglese.`);

skill('database-schema', 'Progetta schema database da requisiti', 'codice',
`Progetta lo schema database:
- TABELLE: nome, colonne con tipo, PK, FK, indici
- RELAZIONI: 1:1, 1:N, N:N con tabelle ponte
- NORMALIZZAZIONE: almeno 3NF
- INDICI: suggeriti per le query più comuni
- VINCOLI: CHECK, UNIQUE, DEFAULT, NOT NULL
- MIGRAZIONI: SQL per creare lo schema
Output: diagramma testuale + SQL DDL.`);

// ═══════════════════════════════════════════════════════════════
//  COMUNICAZIONE & MARKETING
// ═══════════════════════════════════════════════════════════════
console.log('[Skills] Comunicazione & Marketing...');

skill('comunicato-stampa', 'Genera comunicati stampa professionali', 'comunicazione',
`Struttura comunicato stampa:
- TITOLO: max 80 char, informativo e accattivante
- SOTTOTITOLO: contesto aggiuntivo
- LEAD: chi, cosa, quando, dove, perché (primo paragrafo)
- CORPO: dettagli in ordine di importanza decrescente
- CITAZIONE: virgolettata del portavoce
- BOILERPLATE: chi è l'azienda (3 righe)
- CONTATTI: ufficio stampa
Lunghezza: 400-600 parole. Tono: giornalistico, oggettivo.`);

skill('piano-editoriale', 'Crea piano editoriale mensile per blog/social', 'marketing',
`Genera piano editoriale per il mese:
Per ogni settimana:
| Giorno | Piattaforma | Tipo contenuto | Titolo/Argomento | Keyword | CTA |
TIPOLOGIE: articolo blog, post social, newsletter, video script, infografica
Include: pillar content + contenuti derivati
CALENDARIO: rispetta festività e eventi di settore.`);

skill('newsletter-template', 'Genera newsletter HTML responsive', 'comunicazione',
`Genera newsletter HTML con:
- Template responsive (max 600px width)
- Header con logo placeholder e titolo
- Sezione hero con immagine placeholder e headline
- 2-3 blocchi contenuto con titolo, testo breve, CTA
- Sezione news/link rapidi
- Footer con social icons, unsubscribe, indirizzo
Stile: inline CSS, compatibile email client (no flexbox/grid).`);

skill('proposta-commerciale', 'Genera proposte commerciali/preventivi strutturati', 'comunicazione',
`Struttura proposta commerciale:
1. COPERTINA: logo, titolo, destinatario, data
2. EXECUTIVE SUMMARY: problema → soluzione in 5 righe
3. CONTESTO: analisi della situazione attuale del cliente
4. SOLUZIONE PROPOSTA: cosa, come, timeline
5. DELIVERABLE: lista dettagliata con descrizione
6. PRICING: tabella con voci, quantità, prezzi, totale
7. TIMELINE: fasi con date milestone
8. TEAM: chi lavora al progetto
9. CONDIZIONI: pagamento, validità, T&C
10. NEXT STEPS: come procedere
Tono: professionale, orientato al valore non al costo.`);

// ═══════════════════════════════════════════════════════════════
//  LEGALE & COMPLIANCE
// ═══════════════════════════════════════════════════════════════
console.log('[Skills] Legale & Compliance...');

skill('privacy-gdpr', 'Genera e verifica informative privacy GDPR', 'legale',
`Genera/verifica informativa privacy conforme GDPR:
Art. 13-14: identità titolare, DPO, finalità, base giuridica
Categorie dati: personali, sensibili, giudiziari
Destinatari: a chi vengono comunicati
Trasferimento extra-UE: base giuridica
Periodo conservazione: per ogni finalità
Diritti: accesso, rettifica, cancellazione, portabilità, opposizione
Consenso: moduli con checkbox separate per finalità
Cookie policy: categorie, durata, opt-in/opt-out.`);

skill('analisi-normativa', 'Analizza testi normativi e ne estrae obblighi operativi', 'legale',
`Analizza il testo normativo ed estrai:
1. SOGGETTI OBBLIGATI: chi deve adempiere
2. OBBLIGHI: cosa fare, entro quando
3. SANZIONI: per inadempimento
4. ADEMPIMENTI: lista operativa con scadenze
5. DOCUMENTI RICHIESTI: cosa predisporre
6. RIFERIMENTI: articoli, commi, rimandi ad altre norme
Output: tabella operativa "CHI | DEVE FARE | ENTRO QUANDO | SANZIONE".`);

// ═══════════════════════════════════════════════════════════════
//  FINANZA & BUSINESS
// ═══════════════════════════════════════════════════════════════
console.log('[Skills] Finanza & Business...');

skill('analisi-bilancio', 'Analizza bilanci aziendali con indici e trend', 'finanza',
`Analizza il bilancio ed estrai:
STATO PATRIMONIALE: attivo, passivo, patrimonio netto
CONTO ECONOMICO: ricavi, costi, EBITDA, EBIT, utile netto
INDICI: ROE, ROI, ROS, liquidità corrente, acid test, leverage
TREND: confronto con anno precedente, variazioni %
CASH FLOW: operativo, investimenti, finanziario
VALUTAZIONE: punti di forza, criticità, rischi
Output: tabelle con indici + commento per stakeholder.`);

skill('business-plan', 'Struttura business plan da idea a numeri', 'finanza',
`Struttura business plan:
1. EXECUTIVE SUMMARY: idea in 200 parole
2. PROBLEMA/OPPORTUNITÀ: mercato target, pain point
3. SOLUZIONE: prodotto/servizio, value proposition
4. MODELLO DI BUSINESS: come guadagna, pricing
5. MERCATO: TAM, SAM, SOM con fonti
6. CONCORRENZA: mappa competitiva, differenziazione
7. GO-TO-MARKET: canali, acquisizione, costi
8. TEAM: competenze chiave
9. FINANCIALS: P&L 3 anni, break-even, funding needs
10. MILESTONES: roadmap 12-18 mesi.`);

// ═══════════════════════════════════════════════════════════════
//  HR & ORGANIZZAZIONE
// ═══════════════════════════════════════════════════════════════
console.log('[Skills] HR & Organizzazione...');

skill('job-description', 'Genera job description professionali e inclusive', 'hr',
`Genera job description:
TITOLO: chiaro, searchable
AZIENDA: chi siamo (3 righe)
RUOLO: responsabilità principali (5-7 bullet)
REQUISITI: must-have vs nice-to-have (separati)
COMPETENZE: tecniche + soft skills
OFFERTA: cosa offriamo (crescita, benefit, RAL range)
PROCESSO: come candidarsi, step di selezione
Linguaggio: inclusivo, genere neutro, no discriminazioni.`);

skill('valutazione-cv', 'Analizza CV e genera scheda di valutazione candidato', 'hr',
`Analizza il CV ed estrai:
ANAGRAFICA: nome, contatti, sede
ESPERIENZA: aziende, ruoli, durate, progressione
FORMAZIONE: titoli, certificazioni, corsi
COMPETENZE: tecniche + soft, livello stimato
LINGUE: con livello
MATCH: confronta con job description se fornita
PUNTEGGIO: 1-10 per esperienza, formazione, competenze, fit
RED FLAGS: gap inspiegati, job hopping, incongruenze
Output: scheda valutazione strutturata.`);

// ═══════════════════════════════════════════════════════════════
//  ANALISI DATI
// ═══════════════════════════════════════════════════════════════
console.log('[Skills] Analisi Dati...');

skill('analisi-csv', 'Analizza file CSV e genera insight', 'analisi',
`Analizza il dataset CSV fornito:
STRUTTURA: colonne, tipi, righe, valori mancanti
STATISTICHE: per ogni colonna numerica → min, max, media, mediana, deviazione
DISTRIBUZIONE: top/bottom values per colonne categoriche
CORRELAZIONI: tra colonne numeriche significative
ANOMALIE: outlier, valori sospetti, pattern inattesi
INSIGHT: 3-5 osservazioni rilevanti per il business
VISUALIZZAZIONE: suggerisci grafici appropriati
Output: tabelle + commento testuale.`);

skill('report-kpi', 'Genera report KPI da dati grezzi', 'analisi',
`Trasforma dati in report KPI:
DASHBOARD TESTUALE:
- KPI principali con valore, target, delta%, trend (▲▼)
- Semaforo: 🔴 sotto target, 🟡 vicino, 🟢 raggiunto
ANALISI:
- Performance vs periodo precedente
- Cause principali per KPI sotto target
- Azioni correttive suggerite
FORECAST: proiezione a fine periodo se trend continua
Formato: pronto per presentazione management.`);

// ═══════════════════════════════════════════════════════════════
//  TRADUZIONE & LINGUE
// ═══════════════════════════════════════════════════════════════
console.log('[Skills] Traduzione & Lingue...');

skill('traduzione-professionale', 'Traduzione professionale con adattamento culturale e glossario', 'traduzione',
`Traduci il testo con qualità professionale:
1. ANALISI: identifica registro, tono, dominio tecnico
2. TRADUZIONE: mantieni significato, sfumature e stile
3. ADATTAMENTO CULTURALE: localizza riferimenti culturali, unità di misura, formati data
4. GLOSSARIO: se presente terminologia tecnica, crea glossario dei termini chiave
5. NOTE: segnala ambiguità, giochi di parole non traducibili, scelte traduttive
Formati supportati: testo libero, HTML, Markdown, JSON (traduce solo i valori).
Output: testo tradotto + note del traduttore.`);

skill('localizzazione-software', 'Localizzazione UI/UX con glossario tecnico e plurali', 'traduzione',
`Localizza stringhe software:
- Traduci mantenendo placeholder ({name}, {{count}}, %s, $t())
- Gestisci PLURALI secondo le regole della lingua target
- Mantieni MARKUP HTML/Markdown nelle stringhe
- GLOSSARIO: crea tabella termine_originale → termine_tradotto
- LUNGHEZZA: segnala traduzioni significativamente più lunghe (problemi UI)
- TONO: mantieni consistenza con il prodotto (formale/informale)
Input accettati: JSON, YAML, PO, XLIFF, stringhe libere.
Output: file tradotto nello stesso formato + report problemi.`);

// ═══════════════════════════════════════════════════════════════
//  AUDIO & VIDEO
// ═══════════════════════════════════════════════════════════════
console.log('[Skills] Audio & Video...');

skill('trascrizione-meeting', 'Trascrivi e riassumi riunioni da audio/video', 'audio-video',
`Processa la trascrizione audio/video di una riunione:
1. PULIZIA: rimuovi filler (uhm, cioè), correggi errori di trascrizione evidenti
2. SPEAKER: identifica diversi parlanti se possibile (Speaker 1, 2, ...)
3. STRUTTURA: dividi in sezioni tematiche con timestamp
4. RIASSUNTO: executive summary 200 parole
5. DECISIONI: lista di tutte le decisioni prese
6. AZIONI: chi deve fare cosa, entro quando
7. DOMANDE APERTE: punti rimasti irrisolti
Output: verbale strutturato pronto per condivisione.`);

skill('script-video', 'Genera script professionali per video e podcast', 'audio-video',
`Genera script video/podcast:
APERTURA: hook nei primi 5 secondi, presentazione
CORPO: suddiviso in sezioni con timing stimato
- Per ogni sezione: narrazione + indicazioni visive/B-roll
- Transizioni tra sezioni
CHIUSURA: riepilogo, CTA, saluti
METADATI: titolo, descrizione SEO, tag suggeriti, thumbnail idea
Adatta al formato: YouTube, TikTok/Reels (verticale, <60s), podcast, webinar.
Include note di regia e indicazioni per il montaggio.`);

skill('analisi-podcast', 'Estrai key points, citazioni e insight da podcast/interviste', 'audio-video',
`Dalla trascrizione del podcast estrai:
1. SINTESI: di cosa si parla in 100 parole
2. KEY POINTS: 5-10 punti chiave con citazione diretta
3. CITAZIONI: frasi d'impatto virgolettate con speaker
4. DATI/NUMERI: tutti i dati quantitativi menzionati
5. RISORSE: libri, tool, link, persone citate
6. CONTROVERSIE: opinioni contrastanti o provocatorie
7. CLIP SOCIALI: 3-5 estratti ottimi per social (max 30 parole ciascuno)
Output: scheda podcast pronta per newsletter/blog.`);

// ═══════════════════════════════════════════════════════════════
//  IMMAGINI & DESIGN
// ═══════════════════════════════════════════════════════════════
console.log('[Skills] Immagini & Design...');

skill('analisi-design', 'Review UI/UX design da screenshot con feedback dettagliato', 'design',
`Analizza lo screenshot dell'interfaccia:
VISUAL DESIGN:
- Gerarchia visiva, uso dello spazio, allineamenti
- Palette colori, contrasti, leggibilità
- Tipografia, dimensioni, spaziatura
- Consistenza con design system
UX:
- Chiarezza delle azioni (CTA, bottoni, link)
- Feedback visivo (stati, loading, errori)
- Flusso utente intuibile dallo screenshot
- Accessibilità (WCAG 2.1 stimata)
Per ogni problema: screenshot area, issue, soluzione, priorità.`);

skill('genera-prompt-immagine', 'Genera prompt ottimizzati per DALL-E, Midjourney, Stable Diffusion', 'design',
`Dall'idea dell'utente genera prompt ottimizzati per AI image generation:
PER DALL-E 3:
- Prompt dettagliato in inglese (stile, composizione, illuminazione, atmosfera)
- Negative prompt se applicabile
PER MIDJOURNEY:
- Prompt con parametri (--ar, --s, --v, --q)
- Varianti con stili diversi
PER STABLE DIFFUSION:
- Prompt positivo + negativo
- Suggerimenti per modello/checkpoint
Per ciascuno: 3 varianti (realistico, artistico, minimalista).
Include: aspect ratio consigliato, stile artistico, riferimenti.`);

skill('ocr-documento', 'OCR intelligente: estrae e struttura testo da immagini di documenti', 'design',
`Analizza l'immagine del documento e:
1. ESTRAZIONE: trascrivi TUTTO il testo visibile nell'immagine
2. STRUTTURA: identifica il tipo di documento (fattura, carta identità, contratto, ricevuta, modulo)
3. CAMPI: estrai campi strutturati in base al tipo:
   - Fattura: numero, data, importi, P.IVA, righe
   - Documento identità: nome, cognome, nascita, codice fiscale, scadenza
   - Contratto: parti, date, importi chiave
   - Ricevuta: esercizio, data, importo, pagamento
4. QUALITÀ: segnala testo illeggibile o incerto con [?]
Output: JSON strutturato + testo raw completo.`);

// ═══════════════════════════════════════════════════════════════
//  DATA SCIENCE
// ═══════════════════════════════════════════════════════════════
console.log('[Skills] Data Science...');

skill('analisi-sentimento', 'Sentiment analysis su testi, recensioni, feedback con scoring', 'data-science',
`Analizza il sentimento dei testi forniti:
PER OGNI TESTO:
- Sentimento: POSITIVO / NEGATIVO / NEUTRO / MISTO
- Score: -1.0 (molto negativo) a +1.0 (molto positivo)
- Emozioni: gioia, rabbia, tristezza, sorpresa, paura, disgusto
- Aspetti: cosa è positivo/negativo specificamente
AGGREGATO:
- Distribuzione sentimenti (%)
- Trend se testi sono temporali
- Word cloud: parole più associate a positivo/negativo
- Pain points: top 5 lamentele ricorrenti
- Highlights: top 5 punti di forza
Output: tabella per testo + analisi aggregata.`);

skill('clustering-testi', 'Raggruppamento automatico di testi simili per topic/intent', 'data-science',
`Analizza la collezione di testi e:
1. CLUSTERING: raggruppa per similarità semantica
2. ETICHETTE: assegna un nome descrittivo a ogni cluster
3. DISTRIBUZIONE: quanti testi per cluster (%)
4. RAPPRESENTATIVI: 2-3 testi esempio per cluster
5. OUTLIER: testi che non rientrano in nessun cluster
6. GERARCHIA: se possibile, crea sotto-cluster
APPLICAZIONI: categorizazione ticket, topic modeling, intent detection.
Output: tabella cluster + distribuzione + esempi.`);

skill('pulizia-dati', 'Data cleaning: normalizza, deduplicata, valida dataset', 'data-science',
`Analizza il dataset e suggerisci pulizia:
1. PROFILING: statistiche per ogni colonna, tipi, formati
2. VALORI MANCANTI: quanti, pattern, strategia (rimozione/imputazione)
3. DUPLICATI: righe duplicate o quasi-duplicate, criterio matching
4. FORMATI INCONSISTENTI: date, numeri, stringhe (es. "Milano" vs "MILANO" vs "milano")
5. OUTLIER: valori anomali con metodo di rilevamento
6. NORMALIZZAZIONE: suggerisci trasformazioni (encoding categoriche, scaling numerico)
7. SCRIPT: genera codice Python/SQL per la pulizia
Output: report problemi + script di pulizia + dataset sample pulito.`);

// ═══════════════════════════════════════════════════════════════
//  AUTOMAZIONE & PRODUTTIVITA'
// ═══════════════════════════════════════════════════════════════
console.log('[Skills] Automazione & Produttivita...');

skill('email-auto-reply', 'Genera risposte email professionali contestuali', 'automazione',
`Genera risposta email professionale:
ANALISI EMAIL RICEVUTA:
- Mittente, oggetto, intent principale
- Urgenza stimata, tono
- Richieste/domande specifiche
RISPOSTA:
- Tono: adatta a quello del mittente (formale/informale)
- Struttura: saluto, riferimento email ricevuta, risposta punto per punto, chiusura
- Include: conferma ricezione, timeline se richiesta, next steps
VARIANTI: genera 2 versioni (breve e dettagliata)
Lingua: stessa dell'email ricevuta.`);

skill('social-media-post', 'Genera post ottimizzati per ogni piattaforma social', 'automazione',
`Dall'argomento genera post per:
LINKEDIN: professionale, 1300 char, hook, valore, CTA, 3-5 hashtag
TWITTER/X: max 280 char, conciso, hashtag, thread se necessario
INSTAGRAM: caption engaging, emoji moderati, 20-30 hashtag in fondo
FACEBOOK: tono conversazionale, domanda engagement, link
TIKTOK: script breve, trend-aware, hashtag virali
Per ogni piattaforma: orario pubblicazione suggerito, formato media consigliato.
Include: calendario pubblicazione ottimale per la settimana.`);

skill('report-automatico', 'Genera report periodici strutturati da dati grezzi', 'automazione',
`Genera report periodico professionale:
INTESTAZIONE: titolo, periodo, autore, data generazione
EXECUTIVE SUMMARY: 3-5 bullet point con KPI principali
SEZIONI:
1. Performance: metriche vs target con grafici testuali
2. Trend: confronto con periodo precedente
3. Highlights: successi e risultati notevoli
4. Criticità: problemi e rischi identificati
5. Raccomandazioni: azioni suggerite con priorità
APPENDICE: tabelle dati dettagliati
Formati: Markdown, HTML (pronto per email), testo semplice.
Tono: oggettivo, data-driven, orientato alle decisioni.`);

console.log('\n✅ Skills library completata!');
const count: any = db.prepare('SELECT COUNT(*) as cnt FROM skills').get();
console.log(`   Totale skills installate: ${count.cnt}\n`);

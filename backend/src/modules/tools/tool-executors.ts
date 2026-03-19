import fs from 'fs';
import path from 'path';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { ToolExecutor, ToolContext, ToolResult } from './tools.types';
import { searchMemory, saveMemory } from '../memory/memory.service';
import { config } from '../../config';
import { providerRegistry } from '../providers/provider-registry';
import { GeminiAdapter } from '../providers/adapters/gemini.adapter';

const execFileAsync = promisify(execFile);

// ─── Dev Server Tracking ────────────────────────────────────────
const runningDevServers = new Map<string, { pid: number; port: number; process: any }>();

// ─── Workspace Tracking (exported for engine) ───────────────────
export const workspaces = new Map<string, { path: string; type: string; projectId?: string }>();

// ─── Built-in Tool Executors ────────────────────────────────────

const webSearchTool: ToolExecutor = {
  name: 'web_search',
  async execute(params: { query: string }): Promise<ToolResult> {
    // Uses a simple fetch-based search (DuckDuckGo instant answers)
    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(params.query)}&format=json&no_html=1`;
      const response = await fetch(url);
      const data: any = await response.json();
      const results: string[] = [];
      if (data.AbstractText) results.push(`Risposta: ${data.AbstractText}`);
      if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics.slice(0, 5)) {
          if (topic.Text) results.push(`- ${topic.Text}`);
        }
      }
      return {
        success: true,
        output: results.length > 0 ? results.join('\n') : `Nessun risultato per: "${params.query}"`,
      };
    } catch (err: any) {
      return { success: false, output: '', error: `Errore ricerca: ${err.message}` };
    }
  },
};

const readFileTool: ToolExecutor = {
  name: 'read_file',
  async execute(params: { path: string }): Promise<ToolResult> {
    try {
      const filePath = params.path.startsWith('~/')
        ? path.join(process.env.HOME || '', params.path.slice(2))
        : params.path;
      if (!fs.existsSync(filePath)) {
        return { success: false, output: '', error: `File non trovato: ${filePath}` };
      }
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        const files = fs.readdirSync(filePath).filter(f => !f.startsWith('.')).slice(0, 50);
        return { success: true, output: `Contenuto cartella (${files.length} elementi):\n${files.join('\n')}` };
      }
      const content = fs.readFileSync(filePath, 'utf-8').slice(0, 20000);
      return { success: true, output: content };
    } catch (err: any) {
      return { success: false, output: '', error: `Errore lettura: ${err.message}` };
    }
  },
};

const writeFileTool: ToolExecutor = {
  name: 'write_file',
  async execute(params: { path: string; content: string }): Promise<ToolResult> {
    try {
      const filePath = params.path.startsWith('~/')
        ? path.join(process.env.HOME || '', params.path.slice(2))
        : params.path;
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, params.content, 'utf-8');
      return { success: true, output: `File scritto: ${filePath} (${params.content.length} caratteri)` };
    } catch (err: any) {
      return { success: false, output: '', error: `Errore scrittura: ${err.message}` };
    }
  },
};

const shellExecTool: ToolExecutor = {
  name: 'shell_exec',
  async execute(params: { command: string; timeout?: number }, context: ToolContext): Promise<ToolResult> {
    try {
      const timeout = params.timeout || 30000;
      const cwd = context.outputDir || process.cwd();
      const { stdout, stderr } = await execFileAsync('bash', ['-c', params.command], {
        timeout,
        cwd,
        env: { ...process.env },
      });
      const output = stdout + (stderr ? `\nSTDERR: ${stderr}` : '');
      return { success: true, output: output.slice(0, 10000) };
    } catch (err: any) {
      return {
        success: false,
        output: err.stdout || '',
        error: `Errore comando: ${err.message}\n${err.stderr || ''}`,
      };
    }
  },
};

const httpRequestTool: ToolExecutor = {
  name: 'http_request',
  async execute(params: { url: string; method?: string; headers?: Record<string, string>; body?: string }): Promise<ToolResult> {
    try {
      const options: RequestInit = {
        method: params.method || 'GET',
        headers: params.headers || {},
      };
      if (params.body && options.method !== 'GET') {
        options.body = params.body;
      }
      const response = await fetch(params.url, options);
      const text = await response.text();
      return {
        success: response.ok,
        output: `Status: ${response.status}\n${text.slice(0, 10000)}`,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (err: any) {
      return { success: false, output: '', error: `Errore HTTP: ${err.message}` };
    }
  },
};

const memorySearchTool: ToolExecutor = {
  name: 'memory_search',
  async execute(params: { query: string; limit?: number }, context: ToolContext): Promise<ToolResult> {
    const results = searchMemory(params.query, {
      project_id: context.projectId,
      limit: params.limit || 5,
    });
    if (results.length === 0) {
      return { success: true, output: `Nessuna memoria trovata per: "${params.query}"` };
    }
    const output = results.map((m, i) =>
      `[${i + 1}] ${m.summary || m.content.slice(0, 200)} (importanza: ${m.importance}, accessi: ${m.access_count})`
    ).join('\n');
    return { success: true, output: `Memorie trovate (${results.length}):\n${output}` };
  },
};

const memorySaveTool: ToolExecutor = {
  name: 'memory_save',
  async execute(params: { content: string; tags?: string[] }, context: ToolContext): Promise<ToolResult> {
    const entry = saveMemory({
      project_id: context.projectId,
      agent_id: context.agentId,
      content: params.content,
      tags: params.tags || [],
      source: 'tool_call',
    });
    return { success: true, output: `Memoria salvata con ID: ${entry.id}` };
  },
};

// ─── Document Parsing ───────────────────────────────────────────

const parseDocumentTool: ToolExecutor = {
  name: 'parse_document',
  async execute(params: { path: string; pages?: string }): Promise<ToolResult> {
    try {
      const filePath = params.path.startsWith('~/')
        ? path.join(process.env.HOME || '', params.path.slice(2))
        : params.path;
      if (!fs.existsSync(filePath)) {
        return { success: false, output: '', error: `File non trovato: ${filePath}` };
      }
      const ext = path.extname(filePath).toLowerCase();

      if (ext === '.pdf') {
        const pdfParseModule = await import('pdf-parse');
        const pdfParse = (pdfParseModule as any).default || pdfParseModule;
        const buffer = fs.readFileSync(filePath);
        const data = await pdfParse(buffer);
        const text = params.pages
          ? data.text.slice(0, 50000)
          : data.text.slice(0, 30000);
        return {
          success: true,
          output: `[PDF] Pagine: ${data.numpages} | Caratteri: ${data.text.length}\n\n${text}`,
        };
      }

      if (ext === '.docx') {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ path: filePath });
        return {
          success: true,
          output: `[DOCX] Caratteri: ${result.value.length}\n\n${result.value.slice(0, 30000)}`,
        };
      }

      if (ext === '.xlsx' || ext === '.xls') {
        const XLSX = await import('xlsx');
        const workbook = XLSX.readFile(filePath);
        const sheets: string[] = [];
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          sheets.push(`=== Foglio: ${sheetName} ===\n${csv}`);
        }
        const output = sheets.join('\n\n').slice(0, 30000);
        return {
          success: true,
          output: `[XLSX] Fogli: ${workbook.SheetNames.length}\n\n${output}`,
        };
      }

      if (ext === '.csv') {
        const content = fs.readFileSync(filePath, 'utf-8');
        return {
          success: true,
          output: `[CSV] Righe: ${content.split('\n').length}\n\n${content.slice(0, 30000)}`,
        };
      }

      // Fallback: try as text
      const content = fs.readFileSync(filePath, 'utf-8').slice(0, 30000);
      return { success: true, output: content };
    } catch (err: any) {
      return { success: false, output: '', error: `Errore parsing documento: ${err.message}` };
    }
  },
};

// ─── Image Generation (DALL-E 3) ────────────────────────────────

const generateImageTool: ToolExecutor = {
  name: 'generate_image',
  async execute(params: {
    prompt: string;
    size?: string;
    quality?: string;
    style?: string;
  }, context: ToolContext): Promise<ToolResult> {
    try {
      if (!config.openaiApiKey) {
        return { success: false, output: '', error: 'OPENAI_API_KEY non configurata' };
      }
      const size = params.size || '1024x1024';
      const quality = params.quality || 'standard';
      const style = params.style || 'vivid';

      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: params.prompt,
          n: 1,
          size,
          quality,
          style,
          response_format: 'b64_json',
        }),
      });
      if (!res.ok) throw new Error(`DALL-E error: ${res.status} ${await res.text()}`);
      const data: any = await res.json();
      const b64 = data.data[0]?.b64_json;
      if (!b64) throw new Error('Nessuna immagine generata');

      const outputDir = context.outputDir || config.outputsDir;
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
      const fileName = `image_${Date.now()}.png`;
      const filePath = path.join(outputDir, fileName);
      fs.writeFileSync(filePath, Buffer.from(b64, 'base64'));

      const revisedPrompt = data.data[0]?.revised_prompt || '';
      return {
        success: true,
        output: `Immagine generata: ${filePath}\nPrompt rivisto: ${revisedPrompt}`,
      };
    } catch (err: any) {
      return { success: false, output: '', error: `Errore generazione immagine: ${err.message}` };
    }
  },
};

// ─── Image Analysis (Vision) ────────────────────────────────────

const analyzeImageTool: ToolExecutor = {
  name: 'analyze_image',
  async execute(params: { path: string; prompt?: string }): Promise<ToolResult> {
    try {
      const imagePath = params.path.startsWith('~/')
        ? path.join(process.env.HOME || '', params.path.slice(2))
        : params.path;
      if (!fs.existsSync(imagePath)) {
        return { success: false, output: '', error: `Immagine non trovata: ${imagePath}` };
      }
      const prompt = params.prompt || 'Descrivi dettagliatamente cosa vedi in questa immagine.';

      // Try Gemini Vision first
      if (config.geminiApiKey) {
        const gemini = providerRegistry.get('gemini') as GeminiAdapter;
        if (gemini) {
          const result = await gemini.analyzeImages([imagePath], prompt);
          return { success: true, output: result };
        }
      }

      // Fallback: OpenAI GPT-4o Vision
      if (config.openaiApiKey) {
        const ext = path.extname(imagePath).toLowerCase();
        let mimeType = 'image/jpeg';
        if (ext === '.png') mimeType = 'image/png';
        else if (ext === '.webp') mimeType = 'image/webp';
        else if (ext === '.gif') mimeType = 'image/gif';

        const imageData = fs.readFileSync(imagePath);
        const b64 = imageData.toString('base64');

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.openaiApiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${b64}` } },
              ],
            }],
            max_tokens: 4096,
          }),
        });
        if (!res.ok) throw new Error(`OpenAI Vision error: ${res.status}`);
        const data: any = await res.json();
        return { success: true, output: data.choices[0]?.message?.content || '' };
      }

      return { success: false, output: '', error: 'Nessun provider vision disponibile (serve GEMINI_API_KEY o OPENAI_API_KEY)' };
    } catch (err: any) {
      return { success: false, output: '', error: `Errore analisi immagine: ${err.message}` };
    }
  },
};

// ─── Text to Speech (OpenAI TTS) ────────────────────────────────

const textToSpeechTool: ToolExecutor = {
  name: 'text_to_speech',
  async execute(params: {
    text: string;
    voice?: string;
    speed?: number;
  }, context: ToolContext): Promise<ToolResult> {
    try {
      if (!config.openaiApiKey) {
        return { success: false, output: '', error: 'OPENAI_API_KEY non configurata per TTS' };
      }
      const voice = params.voice || 'alloy';
      const speed = params.speed || 1.0;

      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: params.text.slice(0, 4096),
          voice,
          speed,
          response_format: 'mp3',
        }),
      });
      if (!res.ok) throw new Error(`TTS error: ${res.status} ${await res.text()}`);

      const buffer = Buffer.from(await res.arrayBuffer());
      const outputDir = context.outputDir || config.outputsDir;
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
      const fileName = `speech_${Date.now()}.mp3`;
      const filePath = path.join(outputDir, fileName);
      fs.writeFileSync(filePath, buffer);

      return {
        success: true,
        output: `Audio generato: ${filePath} (${(buffer.length / 1024).toFixed(1)} KB, voce: ${voice})`,
      };
    } catch (err: any) {
      return { success: false, output: '', error: `Errore TTS: ${err.message}` };
    }
  },
};

// ─── Speech to Text (OpenAI Whisper) ────────────────────────────

const speechToTextTool: ToolExecutor = {
  name: 'speech_to_text',
  async execute(params: { path: string; language?: string; prompt?: string }): Promise<ToolResult> {
    try {
      if (!config.openaiApiKey) {
        return { success: false, output: '', error: 'OPENAI_API_KEY non configurata per Whisper' };
      }
      const filePath = params.path.startsWith('~/')
        ? path.join(process.env.HOME || '', params.path.slice(2))
        : params.path;
      if (!fs.existsSync(filePath)) {
        return { success: false, output: '', error: `File audio non trovato: ${filePath}` };
      }

      const fileBuffer = fs.readFileSync(filePath);
      const fileName = path.basename(filePath);
      const blob = new Blob([fileBuffer]);
      const formData = new FormData();
      formData.append('file', blob, fileName);
      formData.append('model', 'whisper-1');
      if (params.language) formData.append('language', params.language);
      if (params.prompt) formData.append('prompt', params.prompt);
      formData.append('response_format', 'verbose_json');

      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${config.openaiApiKey}` },
        body: formData,
      });
      if (!res.ok) throw new Error(`Whisper error: ${res.status} ${await res.text()}`);
      const data: any = await res.json();

      const duration = data.duration ? `${Math.round(data.duration)}s` : 'N/A';
      const language = data.language || 'N/A';
      return {
        success: true,
        output: `[Trascrizione] Lingua: ${language} | Durata: ${duration}\n\n${data.text}`,
      };
    } catch (err: any) {
      return { success: false, output: '', error: `Errore trascrizione: ${err.message}` };
    }
  },
};

// ─── Translation ────────────────────────────────────────────────

const translateTextTool: ToolExecutor = {
  name: 'translate_text',
  async execute(params: {
    text: string;
    target_language: string;
    source_language?: string;
  }): Promise<ToolResult> {
    try {
      const sourceLang = params.source_language || 'auto-detect';
      const systemPrompt = `Sei un traduttore professionale. Traduci il testo in ${params.target_language}. ` +
        `Lingua sorgente: ${sourceLang}. Mantieni formattazione, tono e significato originale. ` +
        `Rispondi SOLO con la traduzione, niente altro.`;

      // Try fastest available provider
      const providers = ['gemini', 'openai', 'anthropic', 'ollama'];
      for (const pid of providers) {
        const adapter = providerRegistry.get(pid);
        if (!adapter) continue;
        try {
          const canConnect = await adapter.testConnection();
          if (!canConnect) continue;
          const models = await adapter.listModels();
          const model = models[0]?.id;
          if (!model) continue;

          const result = await adapter.chat(
            [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: params.text.slice(0, 15000) },
            ],
            model,
            { temperature: 0.3 }
          );
          return {
            success: true,
            output: `[Traduzione → ${params.target_language}]\n\n${result.content}`,
          };
        } catch {
          continue;
        }
      }
      return { success: false, output: '', error: 'Nessun provider AI disponibile per la traduzione' };
    } catch (err: any) {
      return { success: false, output: '', error: `Errore traduzione: ${err.message}` };
    }
  },
};

// ─── Code Generation ────────────────────────────────────────────

const generateCodeTool: ToolExecutor = {
  name: 'generate_code',
  async execute(params: {
    description: string;
    language: string;
    execute?: boolean;
    filename?: string;
  }, context: ToolContext): Promise<ToolResult> {
    try {
      const lang = params.language || 'javascript';
      const systemPrompt = `Sei un programmatore esperto. Genera codice ${lang} per la richiesta. ` +
        `Rispondi SOLO con il codice, senza markdown, senza spiegazioni, senza backtick.`;

      // Find best coding model
      const providers = ['anthropic', 'openai', 'gemini', 'ollama'];
      let code = '';
      for (const pid of providers) {
        const adapter = providerRegistry.get(pid);
        if (!adapter) continue;
        try {
          const canConnect = await adapter.testConnection();
          if (!canConnect) continue;
          const models = await adapter.listModels();
          const model = models[0]?.id;
          if (!model) continue;

          const result = await adapter.chat(
            [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: params.description },
            ],
            model,
            { temperature: 0.2 }
          );
          code = result.content.replace(/^```\w*\n?/, '').replace(/\n?```$/, '').trim();
          break;
        } catch {
          continue;
        }
      }

      if (!code) {
        return { success: false, output: '', error: 'Nessun provider AI disponibile per generare codice' };
      }

      // Save code to file
      const outputDir = context.outputDir || config.outputsDir;
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
      const extMap: Record<string, string> = {
        javascript: '.js', typescript: '.ts', python: '.py', bash: '.sh',
        html: '.html', css: '.css', sql: '.sql', go: '.go', rust: '.rs',
        java: '.java', cpp: '.cpp', c: '.c', ruby: '.rb', php: '.php',
      };
      const ext = extMap[lang.toLowerCase()] || '.txt';
      const fileName = params.filename || `generated_${Date.now()}${ext}`;
      const filePath = path.join(outputDir, fileName);
      fs.writeFileSync(filePath, code, 'utf-8');

      let output = `Codice generato (${lang}): ${filePath}\n\n${code.slice(0, 5000)}`;

      // Execute if requested
      if (params.execute) {
        const runners: Record<string, string[]> = {
          javascript: ['node', filePath],
          python: ['python3', filePath],
          bash: ['bash', filePath],
          typescript: ['npx', 'tsx', filePath],
        };
        const runner = runners[lang.toLowerCase()];
        if (runner) {
          try {
            const { stdout, stderr } = await execFileAsync(runner[0], runner.slice(1), {
              timeout: 30000,
              cwd: outputDir,
            });
            output += `\n\n=== Output Esecuzione ===\n${stdout}${stderr ? `\nSTDERR: ${stderr}` : ''}`;
          } catch (execErr: any) {
            output += `\n\n=== Errore Esecuzione ===\n${execErr.message}`;
          }
        } else {
          output += `\n\n(Esecuzione automatica non supportata per ${lang})`;
        }
      }

      return { success: true, output };
    } catch (err: any) {
      return { success: false, output: '', error: `Errore generazione codice: ${err.message}` };
    }
  },
};

// ─── Screenshot URL (Puppeteer) ─────────────────────────────────

const screenshotUrlTool: ToolExecutor = {
  name: 'screenshot_url',
  async execute(params: {
    url: string;
    viewport?: string;
    full_page?: boolean;
  }, context: ToolContext): Promise<ToolResult> {
    try {
      const puppeteer = await import('puppeteer');
      const viewports: Record<string, { width: number; height: number }> = {
        desktop: { width: 1920, height: 1080 },
        tablet: { width: 768, height: 1024 },
        mobile: { width: 375, height: 812 },
      };
      const vp = viewports[params.viewport || 'desktop'] || viewports.desktop;
      const fullPage = params.full_page !== false;

      const browser = await puppeteer.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();
      await page.setViewport(vp);
      await page.goto(params.url, { waitUntil: 'networkidle2', timeout: 30000 });

      const outputDir = context.outputDir || config.outputsDir;
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
      const fileName = `screenshot_${Date.now()}.png`;
      const filePath = path.join(outputDir, fileName);
      await page.screenshot({ path: filePath, fullPage });
      await browser.close();

      const stat = fs.statSync(filePath);
      return {
        success: true,
        output: `Screenshot salvato: ${filePath} (${(stat.size / 1024).toFixed(1)} KB, ${vp.width}x${vp.height}, ${fullPage ? 'pagina intera' : 'viewport'})`,
      };
    } catch (err: any) {
      return { success: false, output: '', error: `Errore screenshot: ${err.message}` };
    }
  },
};

// ─── Extract Data (Structured extraction via AI) ────────────────

const extractDataTool: ToolExecutor = {
  name: 'extract_data',
  async execute(params: {
    text: string;
    schema: string;
    instructions?: string;
  }): Promise<ToolResult> {
    try {
      const schemaDesc = params.schema || 'JSON con i campi rilevanti estratti dal testo';
      const systemPrompt = `Sei un sistema di estrazione dati. Estrai dati strutturati dal testo fornito.\n` +
        `Schema output richiesto: ${schemaDesc}\n` +
        `${params.instructions ? `Istruzioni aggiuntive: ${params.instructions}\n` : ''}` +
        `Rispondi SOLO con il JSON valido, niente altro testo.`;

      const providers = ['gemini', 'openai', 'anthropic', 'ollama'];
      for (const pid of providers) {
        const adapter = providerRegistry.get(pid);
        if (!adapter) continue;
        try {
          const canConnect = await adapter.testConnection();
          if (!canConnect) continue;
          const models = await adapter.listModels();
          const model = models[0]?.id;
          if (!model) continue;

          const result = await adapter.chat(
            [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: params.text.slice(0, 15000) },
            ],
            model,
            { temperature: 0.1 }
          );

          // Try to validate JSON
          const jsonMatch = result.content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
              success: true,
              output: JSON.stringify(parsed, null, 2),
            };
          }
          return { success: true, output: result.content };
        } catch {
          continue;
        }
      }
      return { success: false, output: '', error: 'Nessun provider AI disponibile per estrazione dati' };
    } catch (err: any) {
      return { success: false, output: '', error: `Errore estrazione dati: ${err.message}` };
    }
  },
};

// ─── Video Analysis (ffmpeg + Vision + STT) ─────────────────────

const analyzeVideoTool: ToolExecutor = {
  name: 'analyze_video',
  async execute(params: {
    path: string;
    prompt?: string;
    extract_audio?: boolean;
    num_frames?: number;
  }, context: ToolContext): Promise<ToolResult> {
    try {
      const videoPath = params.path.startsWith('~/')
        ? path.join(process.env.HOME || '', params.path.slice(2))
        : params.path;
      if (!fs.existsSync(videoPath)) {
        return { success: false, output: '', error: `Video non trovato: ${videoPath}` };
      }

      const outputDir = context.outputDir || config.outputsDir;
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
      const tempDir = path.join(outputDir, `video_analysis_${Date.now()}`);
      fs.mkdirSync(tempDir, { recursive: true });

      const numFrames = params.num_frames || 4;
      const analysisPrompt = params.prompt || 'Descrivi cosa succede in questo frame del video.';
      const results: string[] = [];

      // Get video duration
      try {
        const { stdout: durationOut } = await execFileAsync('ffprobe', [
          '-v', 'error', '-show_entries', 'format=duration',
          '-of', 'default=noprint_wrappers=1:nokey=1', videoPath,
        ], { timeout: 15000 });
        const duration = parseFloat(durationOut.trim());
        results.push(`Durata video: ${Math.round(duration)}s`);

        // Extract key frames
        const interval = duration / (numFrames + 1);
        for (let i = 1; i <= numFrames; i++) {
          const time = Math.round(interval * i);
          const framePath = path.join(tempDir, `frame_${i}.jpg`);
          try {
            await execFileAsync('ffmpeg', [
              '-ss', String(time), '-i', videoPath,
              '-frames:v', '1', '-q:v', '2', framePath,
            ], { timeout: 15000 });

            // Analyze frame with vision
            const frameResult = await analyzeImageTool.execute(
              { path: framePath, prompt: `${analysisPrompt} (Frame al secondo ${time})` },
              context
            );
            if (frameResult.success) {
              results.push(`\n=== Frame ${i} (${time}s) ===\n${frameResult.output}`);
            }
          } catch {
            results.push(`\n=== Frame ${i} (${time}s) === Errore estrazione frame`);
          }
        }

        // Extract and transcribe audio if requested
        if (params.extract_audio !== false) {
          const audioPath = path.join(tempDir, 'audio.mp3');
          try {
            await execFileAsync('ffmpeg', [
              '-i', videoPath, '-vn', '-acodec', 'libmp3lame',
              '-q:a', '4', audioPath,
            ], { timeout: 60000 });

            if (fs.existsSync(audioPath) && fs.statSync(audioPath).size > 1000) {
              const sttResult = await speechToTextTool.execute(
                { path: audioPath },
                context
              );
              if (sttResult.success) {
                results.push(`\n=== Trascrizione Audio ===\n${sttResult.output}`);
              }
            }
          } catch {
            results.push('\n(Audio non disponibile o non estraibile)');
          }
        }
      } catch (ffErr: any) {
        return { success: false, output: '', error: `ffmpeg/ffprobe non disponibile: ${ffErr.message}. Installa ffmpeg per analisi video.` };
      }

      return { success: true, output: results.join('\n') };
    } catch (err: any) {
      return { success: false, output: '', error: `Errore analisi video: ${err.message}` };
    }
  },
};

// ─── Project Init (Scaffolding) ─────────────────────────────────

const initProjectTool: ToolExecutor = {
  name: 'init_project',
  async execute(params: { path: string; type?: string; name: string }, context: ToolContext): Promise<ToolResult> {
    try {
      const projectType = params.type || 'node';
      const projectPath = params.path.startsWith('~/')
        ? path.join(process.env.HOME || '', params.path.slice(2))
        : params.path;

      if (!fs.existsSync(projectPath)) fs.mkdirSync(projectPath, { recursive: true });

      const gitignore = `node_modules/\ndist/\n.env\n.DS_Store\n__pycache__/\n*.pyc\n.next/\nbuild/\ncoverage/\n`;
      fs.writeFileSync(path.join(projectPath, '.gitignore'), gitignore);
      fs.writeFileSync(path.join(projectPath, 'README.md'), `# ${params.name}\n\nProgetto generato da Agent OS Brain.\n`);

      if (projectType === 'node' || projectType === 'react' || projectType === 'nextjs') {
        const pkg: any = {
          name: params.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          version: '1.0.0',
          private: true,
          scripts: {} as Record<string, string>,
          dependencies: {} as Record<string, string>,
          devDependencies: {} as Record<string, string>,
        };

        if (projectType === 'node') {
          pkg.type = 'module';
          pkg.scripts = { start: 'node src/index.js', dev: 'node --watch src/index.js' };
          fs.mkdirSync(path.join(projectPath, 'src'), { recursive: true });
          fs.writeFileSync(path.join(projectPath, 'src/index.js'), `console.log('${params.name} avviato');\n`);
        } else if (projectType === 'react') {
          pkg.scripts = { dev: 'vite', build: 'vite build', preview: 'vite preview' };
          for (const dir of ['src', 'src/components', 'src/pages', 'public']) {
            fs.mkdirSync(path.join(projectPath, dir), { recursive: true });
          }
        } else if (projectType === 'nextjs') {
          pkg.scripts = { dev: 'next dev', build: 'next build', start: 'next start' };
          for (const dir of ['src/app', 'src/components', 'src/lib', 'public']) {
            fs.mkdirSync(path.join(projectPath, dir), { recursive: true });
          }
        }
        fs.writeFileSync(path.join(projectPath, 'package.json'), JSON.stringify(pkg, null, 2));

      } else if (projectType === 'python') {
        for (const dir of ['src', 'tests']) {
          fs.mkdirSync(path.join(projectPath, dir), { recursive: true });
        }
        fs.writeFileSync(path.join(projectPath, 'requirements.txt'), '');
        fs.writeFileSync(path.join(projectPath, 'src/__init__.py'), '');
        fs.writeFileSync(path.join(projectPath, 'src/main.py'), `def main():\n    print("${params.name} avviato")\n\nif __name__ == "__main__":\n    main()\n`);

      } else {
        for (const dir of ['src', 'docs', 'tests']) {
          fs.mkdirSync(path.join(projectPath, dir), { recursive: true });
        }
      }

      // Track workspace in memory
      workspaces.set(context.projectId, { path: projectPath, type: projectType, projectId: context.projectId });

      // Persist workspace_path to DB
      try {
        const dbModule = await import('../../database/connection');
        const db = dbModule.default;
        db.prepare('UPDATE projects SET workspace_path = ?, project_type = ? WHERE id = ?')
          .run(projectPath, projectType, context.projectId);
      } catch {}

      // Inject AI client template for apps in AgentOS_Apps
      if (projectPath.includes('AgentOS_Apps') || projectPath.includes('agenteos_apps')) {
        try {
          const libDir = path.join(projectPath, 'src', 'lib');
          if (!fs.existsSync(libDir)) fs.mkdirSync(libDir, { recursive: true });
          const templatePath = path.join(__dirname, '..', 'apps', 'templates', 'ai-client.js');
          if (fs.existsSync(templatePath)) {
            fs.copyFileSync(templatePath, path.join(libDir, 'ai-client.js'));
          }
        } catch {}
      }

      return {
        success: true,
        output: `Progetto "${params.name}" (${projectType}) creato in: ${projectPath}`,
      };
    } catch (err: any) {
      return { success: false, output: '', error: `Errore creazione progetto: ${err.message}` };
    }
  },
};

// ─── Install Dependencies ───────────────────────────────────────

const installDepsTool: ToolExecutor = {
  name: 'install_deps',
  async execute(params: { path: string; packages?: string[]; manager?: string }): Promise<ToolResult> {
    try {
      const projectPath = params.path.startsWith('~/')
        ? path.join(process.env.HOME || '', params.path.slice(2))
        : params.path;

      // Auto-detect package manager
      let manager = params.manager || '';
      if (!manager) {
        if (fs.existsSync(path.join(projectPath, 'package-lock.json'))) manager = 'npm';
        else if (fs.existsSync(path.join(projectPath, 'yarn.lock'))) manager = 'yarn';
        else if (fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'))) manager = 'pnpm';
        else if (fs.existsSync(path.join(projectPath, 'requirements.txt'))) manager = 'pip';
        else if (fs.existsSync(path.join(projectPath, 'package.json'))) manager = 'npm';
        else manager = 'npm';
      }

      let cmd: string;
      let args: string[];
      if (manager === 'pip') {
        if (params.packages?.length) {
          cmd = 'pip3';
          args = ['install', ...params.packages];
        } else {
          cmd = 'pip3';
          args = ['install', '-r', 'requirements.txt'];
        }
      } else {
        cmd = manager;
        if (params.packages?.length) {
          args = manager === 'yarn' ? ['add', ...params.packages] : ['install', ...params.packages];
        } else {
          args = ['install'];
        }
      }

      const { stdout, stderr } = await execFileAsync(cmd, args, {
        timeout: 300000, // 5 min
        cwd: projectPath,
        env: { ...process.env },
      });

      const output = `[${manager}] ${params.packages?.length ? params.packages.join(', ') : 'tutte le dipendenze'}\n${stdout.slice(0, 5000)}${stderr ? `\n${stderr.slice(0, 2000)}` : ''}`;
      return { success: true, output };
    } catch (err: any) {
      return { success: false, output: err.stdout?.slice(0, 3000) || '', error: `Errore installazione: ${err.message}` };
    }
  },
};

// ─── Run Dev Server ─────────────────────────────────────────────

const runDevServerTool: ToolExecutor = {
  name: 'run_dev_server',
  async execute(params: { path: string; command?: string; port?: number }, context: ToolContext): Promise<ToolResult> {
    try {
      const projectPath = params.path.startsWith('~/')
        ? path.join(process.env.HOME || '', params.path.slice(2))
        : params.path;

      // Stop existing server if running
      const existing = runningDevServers.get(projectPath);
      if (existing) {
        try { process.kill(existing.pid); } catch {}
        runningDevServers.delete(projectPath);
      }

      const port = params.port || (3000 + Math.floor(Math.random() * 1000));
      let cmd = params.command || '';
      if (!cmd) {
        if (fs.existsSync(path.join(projectPath, 'package.json'))) cmd = 'npm run dev';
        else if (fs.existsSync(path.join(projectPath, 'manage.py'))) cmd = `python3 manage.py runserver ${port}`;
        else cmd = `npx serve -l ${port}`;
      }

      const parts = cmd.split(' ');
      const child = spawn(parts[0], parts.slice(1), {
        cwd: projectPath,
        env: { ...process.env, PORT: String(port) },
        detached: true,
        stdio: 'ignore',
      });
      child.unref();

      if (child.pid) {
        runningDevServers.set(projectPath, { pid: child.pid, port, process: child });
      }

      // Save port to DB if we know the project
      if (context.projectId) {
        try {
          const dbModule = await import('../../database/connection');
          const db = dbModule.default;
          db.prepare('UPDATE projects SET dev_server_port = ? WHERE id = ?')
            .run(port, context.projectId);
        } catch {}
      }

      // Wait a bit for server to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      const url = `http://localhost:${port}`;
      return {
        success: true,
        output: `Dev server avviato: ${url} (PID: ${child.pid}, comando: ${cmd})`,
      };
    } catch (err: any) {
      return { success: false, output: '', error: `Errore avvio dev server: ${err.message}` };
    }
  },
};

// ─── Stop Dev Server ────────────────────────────────────────────

const stopDevServerTool: ToolExecutor = {
  name: 'stop_dev_server',
  async execute(params: { path: string }): Promise<ToolResult> {
    try {
      const projectPath = params.path.startsWith('~/')
        ? path.join(process.env.HOME || '', params.path.slice(2))
        : params.path;

      const server = runningDevServers.get(projectPath);
      if (!server) {
        return { success: true, output: 'Nessun dev server in esecuzione per questo progetto.' };
      }

      try { process.kill(-server.pid); } catch {
        try { process.kill(server.pid); } catch {}
      }
      runningDevServers.delete(projectPath);

      return { success: true, output: `Dev server fermato (PID: ${server.pid}, porta: ${server.port})` };
    } catch (err: any) {
      return { success: false, output: '', error: `Errore stop server: ${err.message}` };
    }
  },
};

// ─── Run Tests ──────────────────────────────────────────────────

const runTestsTool: ToolExecutor = {
  name: 'run_tests',
  async execute(params: { path: string; command?: string }): Promise<ToolResult> {
    try {
      const projectPath = params.path.startsWith('~/')
        ? path.join(process.env.HOME || '', params.path.slice(2))
        : params.path;

      let cmd = params.command || '';
      if (!cmd) {
        if (fs.existsSync(path.join(projectPath, 'package.json'))) cmd = 'npm test';
        else if (fs.existsSync(path.join(projectPath, 'pytest.ini')) || fs.existsSync(path.join(projectPath, 'tests'))) cmd = 'pytest';
        else cmd = 'npm test';
      }

      const parts = cmd.split(' ');
      const { stdout, stderr } = await execFileAsync(parts[0], parts.slice(1), {
        timeout: 300000,
        cwd: projectPath,
        env: { ...process.env },
      });

      const output = `[Test] ${cmd}\n${stdout.slice(0, 8000)}${stderr ? `\nSTDERR: ${stderr.slice(0, 3000)}` : ''}`;
      return { success: true, output };
    } catch (err: any) {
      const output = err.stdout?.slice(0, 5000) || '';
      const hasFailures = output.includes('FAIL') || output.includes('failed');
      return {
        success: false,
        output: `[Test] Risultato:\n${output}`,
        error: hasFailures ? 'Alcuni test falliti' : `Errore esecuzione test: ${err.message}`,
      };
    }
  },
};

// ─── Git Init ───────────────────────────────────────────────────

const gitInitTool: ToolExecutor = {
  name: 'git_init',
  async execute(params: { path: string; initial_commit?: boolean }): Promise<ToolResult> {
    try {
      const projectPath = params.path.startsWith('~/')
        ? path.join(process.env.HOME || '', params.path.slice(2))
        : params.path;

      await execFileAsync('git', ['init'], { cwd: projectPath, timeout: 10000 });

      if (!fs.existsSync(path.join(projectPath, '.gitignore'))) {
        fs.writeFileSync(path.join(projectPath, '.gitignore'), 'node_modules/\n.env\ndist/\n.DS_Store\n__pycache__/\n');
      }

      let output = `Repository Git inizializzato in: ${projectPath}`;

      if (params.initial_commit !== false) {
        await execFileAsync('git', ['add', '.'], { cwd: projectPath, timeout: 15000 });
        await execFileAsync('git', ['commit', '-m', 'Initial commit - Project scaffolded by Agent OS'], { cwd: projectPath, timeout: 15000 });
        output += '\nCommit iniziale creato.';
      }

      return { success: true, output };
    } catch (err: any) {
      return { success: false, output: '', error: `Errore git init: ${err.message}` };
    }
  },
};

// ─── List Project Files (Tree) ──────────────────────────────────

const listProjectFilesTool: ToolExecutor = {
  name: 'list_project_files',
  async execute(params: { path: string; depth?: number; ignore?: string[] }): Promise<ToolResult> {
    try {
      const projectPath = params.path.startsWith('~/')
        ? path.join(process.env.HOME || '', params.path.slice(2))
        : params.path;

      if (!fs.existsSync(projectPath)) {
        return { success: false, output: '', error: `Directory non trovata: ${projectPath}` };
      }

      const maxDepth = params.depth || 4;
      const ignore = new Set(params.ignore || ['node_modules', '.git', '__pycache__', 'dist', '.next', 'build', '.cache', 'coverage', '.venv', 'venv']);

      function buildTree(dir: string, prefix: string, depth: number): string {
        if (depth > maxDepth) return prefix + '...\n';
        const entries = fs.readdirSync(dir).filter(e => !e.startsWith('.') || e === '.env.example').filter(e => !ignore.has(e)).sort((a, b) => {
          const aIsDir = fs.statSync(path.join(dir, a)).isDirectory();
          const bIsDir = fs.statSync(path.join(dir, b)).isDirectory();
          if (aIsDir && !bIsDir) return -1;
          if (!aIsDir && bIsDir) return 1;
          return a.localeCompare(b);
        });

        let result = '';
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          const fullPath = path.join(dir, entry);
          const isLast = i === entries.length - 1;
          const connector = isLast ? '└── ' : '├── ';
          const nextPrefix = prefix + (isLast ? '    ' : '│   ');

          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            result += `${prefix}${connector}${entry}/\n`;
            result += buildTree(fullPath, nextPrefix, depth + 1);
          } else {
            const size = stat.size < 1024 ? `${stat.size}B` : `${(stat.size / 1024).toFixed(1)}K`;
            result += `${prefix}${connector}${entry} (${size})\n`;
          }
        }
        return result;
      }

      const projectName = path.basename(projectPath);
      const tree = `${projectName}/\n${buildTree(projectPath, '', 1)}`;
      return { success: true, output: tree.slice(0, 15000) };
    } catch (err: any) {
      return { success: false, output: '', error: `Errore listing files: ${err.message}` };
    }
  },
};

// ─── Registry ───────────────────────────────────────────────────

const executorMap = new Map<string, ToolExecutor>();

function registerExecutor(executor: ToolExecutor) {
  executorMap.set(executor.name, executor);
}

// Register built-in tools
registerExecutor(webSearchTool);
registerExecutor(readFileTool);
registerExecutor(writeFileTool);
registerExecutor(shellExecTool);
registerExecutor(httpRequestTool);
registerExecutor(memorySearchTool);
registerExecutor(memorySaveTool);

// Register new tools
registerExecutor(parseDocumentTool);
registerExecutor(generateImageTool);
registerExecutor(analyzeImageTool);
registerExecutor(textToSpeechTool);
registerExecutor(speechToTextTool);
registerExecutor(translateTextTool);
registerExecutor(generateCodeTool);
registerExecutor(screenshotUrlTool);
registerExecutor(extractDataTool);
registerExecutor(analyzeVideoTool);

// Register dev/builder tools
registerExecutor(initProjectTool);
registerExecutor(installDepsTool);
registerExecutor(runDevServerTool);
registerExecutor(stopDevServerTool);
registerExecutor(runTestsTool);
registerExecutor(gitInitTool);
registerExecutor(listProjectFilesTool);

export function getToolExecutor(name: string): ToolExecutor | undefined {
  return executorMap.get(name);
}

export function getAllToolExecutors(): ToolExecutor[] {
  return Array.from(executorMap.values());
}

export async function executeTool(
  name: string,
  params: Record<string, any>,
  context: ToolContext
): Promise<ToolResult> {
  const executor = executorMap.get(name);
  if (!executor) {
    return { success: false, output: '', error: `Tool non trovato: ${name}` };
  }
  return executor.execute(params, context);
}

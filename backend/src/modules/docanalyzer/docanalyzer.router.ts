import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { providerRegistry } from '../providers/provider-registry';

const router = Router();

// ─── helpers ────────────────────────────────────────────────────────────────

async function extractText(filePath: string, mime: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf') {
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const buf = fs.readFileSync(filePath);
      const data = await pdfParse(buf);
      return data.text || '';
    } catch { return '[Errore lettura PDF]'; }
  }

  if (ext === '.docx' || ext === '.doc') {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value || '';
    } catch { return '[Errore lettura DOCX]'; }
  }

  if (['.txt', '.md', '.csv', '.json', '.html', '.xml', '.js', '.ts', '.py'].includes(ext)) {
    try { return fs.readFileSync(filePath, 'utf-8'); } catch { return ''; }
  }

  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext)) {
    return `[IMMAGINE: ${path.basename(filePath)}]`;
  }

  return '';
}

function isImage(ext: string) {
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext.toLowerCase());
}

// ─── POST /api/v1/docanalyzer/analyze ────────────────────────────────────────
// Body: multipart with files[], OR JSON { files: [{name, base64, mime}] }
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const contentType = req.headers['content-type'] || '';

    // Parse multipart manually using busboy
    let files: Array<{ name: string; path: string; mime: string; isImg: boolean }> = [];
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docana-'));

    if (contentType.includes('multipart/form-data')) {
      const Busboy = (await import('busboy')).default;
      await new Promise<void>((resolve, reject) => {
        const bb = Busboy({ headers: req.headers, limits: { fileSize: 50 * 1024 * 1024 } });
        bb.on('file', (_field, stream, info) => {
          const safeName = info.filename.replace(/[^a-zA-Z0-9._\-() ]/g, '_');
          const dest = path.join(tmpDir, safeName);
          stream.pipe(fs.createWriteStream(dest));
          files.push({ name: safeName, path: dest, mime: info.mimeType, isImg: isImage(path.extname(safeName)) });
        });
        bb.on('close', resolve);
        bb.on('error', reject);
        req.pipe(bb);
      });
    } else {
      // JSON base64 upload
      const body = req.body as { files?: Array<{ name: string; base64: string; mime: string }> };
      for (const f of body.files || []) {
        const safeName = f.name.replace(/[^a-zA-Z0-9._\-() ]/g, '_');
        const dest = path.join(tmpDir, safeName);
        fs.writeFileSync(dest, Buffer.from(f.base64, 'base64'));
        files.push({ name: safeName, path: dest, mime: f.mime, isImg: isImage(path.extname(safeName)) });
      }
    }

    if (files.length === 0) return res.status(400).json({ error: 'Nessun file ricevuto' });

    // Extract text from each file
    const extracts: Array<{ name: string; text: string; isImg: boolean; path: string }> = [];
    for (const f of files) {
      const text = await extractText(f.path, f.mime);
      extracts.push({ name: f.name, text, isImg: f.isImg, path: f.path });
    }

    // Build prompt for AI
    const docBlocks = extracts.map(e =>
      e.isImg
        ? `### File: ${e.name}\n[Immagine allegata — includi nel articolo se rilevante]`
        : `### File: ${e.name}\n${e.text.slice(0, 6000)}`
    ).join('\n\n---\n\n');

    const imageNames = extracts.filter(e => e.isImg).map(e => e.name);

    const systemPrompt = `Sei un giornalista professionista che scrive articoli in italiano.
Ricevi il contenuto di uno o più documenti e devi generare un file HTML completo e formattato in stile giornalistico.

REGOLE:
- Genera SOLO HTML valido e completo (dalla tag <html> a </html>)
- Stile giornale moderno: testata grande, articoli con titolo H2, occhiello, corpo testo
- Font serif per i testi, sans-serif per titoli
- Colori: sfondo bianco carta, testo nero/grigio scuro, accenti bordeaux/navy
- Ogni documento diventa un articolo separato con titolo, sommario 2-3 righe, testo completo
- Se ci sono immagini (nomi: ${imageNames.join(', ') || 'nessuna'}), inseriscile con <img src="[NOME_FILE]"> nei punti rilevanti
- Aggiungi data, autore "Analisi FLOW AI", sezione "Documenti Analizzati"
- Footer con riepilogo del totale documenti analizzati
- CSS inline o in <style> tag interno
- NO markdown, solo HTML puro`;

    const userMsg = `Analizza questi documenti e genera l'HTML giornalistico:\n\n${docBlocks}`;

    // Call AI provider
    const providers = providerRegistry.getEnabled();
    if (providers.length === 0) return res.status(503).json({ error: 'Nessun provider AI configurato' });

    const provider = providers[0];
    const aiRes = await providerRegistry.chat(
      provider.id,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg }
      ],
      provider.defaultModel,
      { temperature: 0.3, max_tokens: 8000 }
    );

    let html = aiRes.content || '';
    // Extract HTML if wrapped in markdown
    const htmlMatch = html.match(/```html\s*([\s\S]*?)```/i) || html.match(/```\s*([\s\S]*?)```/);
    if (htmlMatch) html = htmlMatch[1];
    if (!html.includes('<html')) {
      html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>Analisi Documenti</title></head><body>${html}</body></html>`;
    }

    // Embed images as base64
    for (const f of extracts.filter(e => e.isImg)) {
      try {
        const b64 = fs.readFileSync(f.path).toString('base64');
        const ext = path.extname(f.name).slice(1).toLowerCase();
        const mime = ext === 'jpg' ? 'jpeg' : ext;
        html = html.replace(new RegExp(`src="${f.name}"`, 'g'), `src="data:image/${mime};base64,${b64}"`);
        html = html.replace(new RegExp(`src='${f.name}'`, 'g'), `src="data:image/${mime};base64,${b64}"`);
      } catch {}
    }

    // Save HTML output
    const outDir = path.join(process.env.HOME || '/tmp', 'Documents', 'FLOW_DocAnalyzer');
    fs.mkdirSync(outDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outFile = path.join(outDir, `articolo_${ts}.html`);
    fs.writeFileSync(outFile, html, 'utf-8');

    // Cleanup tmp
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}

    res.json({
      html,
      savedPath: outFile,
      filesProcessed: extracts.length,
      imagesFound: imageNames.length,
    });

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

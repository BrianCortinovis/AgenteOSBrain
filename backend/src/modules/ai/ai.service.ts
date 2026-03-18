import db from '../../database/connection';
import { providerRegistry } from '../providers/provider-registry';

function stripCodeFences(content: string) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:\w+)?\s*([\s\S]*?)```/);
  return (fenced?.[1] || trimmed).trim();
}

function getFieldInstructions(fieldKind: string) {
  switch (fieldKind) {
    case 'system_prompt':
      return `Stai scrivendo un system prompt pronto all'uso.
- Scrivi in italiano.
- Sii operativo, preciso e specifico.
- Definisci ruolo, obiettivo, regole di lavoro, vincoli e formato di output quando utile.
- Non aggiungere spiegazioni fuori dal prompt.
- Restituisci solo il testo finale del system prompt.`;
    case 'short_text':
      return `Stai scrivendo un testo breve per un campo del prodotto.
- Mantieni il contenuto compatto, chiaro e utilizzabile subito.
- Evita markdown, virgolette decorative e spiegazioni.
- Restituisci solo il testo finale.`;
    default:
      return `Stai scrivendo o migliorando il contenuto di un campo del prodotto.
- Scrivi in italiano.
- Ottimizza chiarezza, completezza e qualità operativa.
- Non usare markdown se non richiesto dal campo.
- Restituisci solo il testo finale del campo.`;
  }
}

export async function assistField(data: any) {
  const providerId = data.provider_id || 'anthropic';
  const modelId = data.model_id || 'claude-cli';
  const fieldLabel = String(data.field_label || 'campo').trim();
  const fieldKind = String(data.field_kind || 'long_text').trim();
  const instruction = String(data.instruction || '').trim();
  const currentValue = String(data.current_value || '').trim();
  const extraContext = String(data.context || '').trim();

  if (!instruction) throw new Error('Istruzione richiesta');

  const project: any = data.project_id
    ? db.prepare('SELECT id, name, description, status FROM projects WHERE id = ?').get(data.project_id)
    : null;

  const systemPrompt = `Sei un assistente di scrittura integrato in Agent OS.
Il tuo compito è riscrivere o completare un singolo campo testuale del prodotto seguendo le istruzioni dell'utente.

${getFieldInstructions(fieldKind)}

Regole globali:
- Non descrivere quello che hai fatto.
- Non aggiungere prefazioni come "Ecco il prompt".
- Non usare blocchi markdown.
- Se il campo è vuoto, crea il contenuto da zero.
- Se il campo ha già un valore, miglioralo mantenendo l'intento richiesto.`;

  const userPrompt = `Contesto progetto:
- nome: ${project?.name || 'n/d'}
- descrizione: ${project?.description || 'n/d'}
- stato: ${project?.status || 'n/d'}

Campo:
- etichetta: ${fieldLabel}
- tipo: ${fieldKind}

Valore attuale:
${currentValue || '[vuoto]'}

Istruzione dell'utente:
${instruction}

Contesto aggiuntivo:
${extraContext || '[nessuno]'}`;

  const response = await providerRegistry.chat(
    providerId,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    modelId,
    { temperature: 0.2, max_tokens: 3000 },
  );

  return {
    content: stripCodeFences(response.content),
    usage: response.usage,
    provider_id: providerId,
    model_id: modelId,
  };
}

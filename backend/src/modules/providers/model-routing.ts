import { config } from '../../config';
import { getAnthropicMode } from './adapters/anthropic.adapter';

export type ModelSelection = {
  providerId: string;
  modelId: string;
};

export type ModelRoutingInput = {
  type?: string;
  label?: string;
  description?: string;
  system_prompt?: string;
  config?: any;
  provider_id?: string;
  model_id?: string;
};

function defaultAnthropicModel() {
  return getAnthropicMode() === 'claude_cli'
    ? 'claude-cli'
    : 'claude-sonnet-4-20250514';
}

function prefersAnthropicAPI() {
  return getAnthropicMode() !== 'claude_cli' && Boolean(config.anthropicApiKey);
}

function normalizeSelection(selection?: Partial<ModelSelection> | null): ModelSelection | null {
  const providerId = String(selection?.providerId || '').trim();
  const modelId = String(selection?.modelId || '').trim();
  if (!providerId || !modelId) return null;
  return { providerId, modelId };
}

export function isProviderAvailable(providerId: string) {
  switch (providerId) {
    case 'openai':
      return Boolean(config.openaiApiKey);
    case 'gemini':
      return Boolean(config.geminiApiKey);
    case 'anthropic':
      return getAnthropicMode() === 'claude_cli' || Boolean(config.anthropicApiKey);
    case 'ollama':
      return true;
    default:
      return false;
  }
}

function pickFirstAvailable(candidates: ModelSelection[], fallback?: Partial<ModelSelection> | null) {
  const validFallback = normalizeSelection(fallback);
  const chosen = candidates.find((candidate) => isProviderAvailable(candidate.providerId));
  if (chosen) return chosen;
  if (validFallback) return validFallback;
  return { providerId: 'anthropic', modelId: defaultAnthropicModel() };
}

export function getFallbackModelSelection(preferred?: Partial<ModelSelection> | null) {
  const normalizedPreferred = normalizeSelection(preferred);
  if (normalizedPreferred && isProviderAvailable(normalizedPreferred.providerId)) {
    return normalizedPreferred;
  }

  return pickFirstAvailable(
    [
      { providerId: 'openai', modelId: 'gpt-4o' },
      { providerId: 'gemini', modelId: 'gemini-2.5-flash' },
      { providerId: 'anthropic', modelId: defaultAnthropicModel() },
      { providerId: 'ollama', modelId: 'llama3.1' },
    ],
    normalizedPreferred,
  );
}

export function selectBestModelForTask(
  input: ModelRoutingInput,
  options?: {
    fallback?: Partial<ModelSelection> | null;
    allowOverrideExplicit?: boolean;
  },
) {
  const explicit = normalizeSelection({
    providerId: input.provider_id,
    modelId: input.model_id,
  });

  if (explicit && !options?.allowOverrideExplicit) {
    return explicit;
  }

  const fallback = getFallbackModelSelection(options?.fallback || explicit);
  const type = String(input.type || '').trim().toLowerCase();
  const serializedConfig = typeof input.config === 'string'
    ? input.config
    : JSON.stringify(input.config || {});
  const text = [
    input.label,
    input.description,
    input.system_prompt,
    serializedConfig,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const hasVisionKeywords = /foto|immagin|image|picture|frame|screenshot|vision|ocr|riconosc|individu|detect|cartella|folder|gallery|galleria|video|motoslitt|montagn|prat|campo/.test(text);
  const hasReasoningKeywords = /decid|decision|valut|confront|scegli|priorit|ranking|score|strateg|verific|classific|approv|deduc|reason|judge/.test(text);
  const hasBuildKeywords = /html|css|javascript|typescript|react|script|codice|code|pagina|landing|sito|template|animaz|render|export|video|poster|locandin|banner|crea file|genera file|frontend|backend|component|bash|python|node/.test(text);
  const hasStructuredAnalysisKeywords = /estrai|extract|riassum|sintetizz|parse|json|schema|tabella|csv|report|analizz|normalizz/.test(text);

  if (type === 'analisi' && hasVisionKeywords) {
    return pickFirstAvailable(
      [
        { providerId: 'gemini', modelId: 'gemini-2.5-flash' },
        { providerId: 'openai', modelId: 'gpt-4o' },
        { providerId: 'anthropic', modelId: defaultAnthropicModel() },
      ],
      explicit || fallback,
    );
  }

  if (type === 'decisione' || hasReasoningKeywords) {
    return pickFirstAvailable(
      prefersAnthropicAPI()
        ? [
            { providerId: 'anthropic', modelId: defaultAnthropicModel() },
            { providerId: 'openai', modelId: 'gpt-4o' },
            { providerId: 'gemini', modelId: 'gemini-2.5-pro' },
          ]
        : [
            { providerId: 'openai', modelId: 'gpt-4o' },
            { providerId: 'gemini', modelId: 'gemini-2.5-pro' },
            { providerId: 'anthropic', modelId: defaultAnthropicModel() },
          ],
      explicit || fallback,
    );
  }

  if (type === 'esecuzione' && hasBuildKeywords) {
    return pickFirstAvailable(
      [
        { providerId: 'anthropic', modelId: defaultAnthropicModel() },
        { providerId: 'openai', modelId: 'gpt-4o' },
        { providerId: 'gemini', modelId: 'gemini-2.5-pro' },
      ],
      explicit || fallback,
    );
  }

  if (type === 'esecuzione') {
    return pickFirstAvailable(
      [
        { providerId: 'openai', modelId: 'gpt-4o' },
        { providerId: 'anthropic', modelId: defaultAnthropicModel() },
        { providerId: 'gemini', modelId: 'gemini-2.5-pro' },
      ],
      explicit || fallback,
    );
  }

  if (type === 'analisi' || hasStructuredAnalysisKeywords) {
    return pickFirstAvailable(
      [
        { providerId: 'openai', modelId: 'gpt-4o-mini' },
        { providerId: 'gemini', modelId: 'gemini-2.5-flash' },
        { providerId: 'anthropic', modelId: defaultAnthropicModel() },
      ],
      explicit || fallback,
    );
  }

  return explicit || fallback;
}

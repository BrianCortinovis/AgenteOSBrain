export const NODE_TYPES = ['sorgente', 'analisi', 'decisione', 'esecuzione', 'memoria', 'automazione'] as const;

export const NODE_STATES = ['bozza', 'pronto', 'in_esecuzione', 'completato', 'bloccato'] as const;

export const NODE_TYPE_LABELS: Record<string, string> = {
  sorgente: 'Sorgente',
  analisi: 'Analisi',
  decisione: 'Decisione',
  esecuzione: 'Esecuzione',
  memoria: 'Memoria',
  automazione: 'Automazione',
};

export const NODE_STATE_LABELS: Record<string, string> = {
  bozza: 'Bozza',
  pronto: 'Pronto',
  in_esecuzione: 'In Esecuzione',
  completato: 'Completato',
  bloccato: 'Bloccato',
};

export const NODE_TYPE_COLORS: Record<string, string> = {
  sorgente: '#3b82f6',
  analisi: '#8b5cf6',
  decisione: '#f59e0b',
  esecuzione: '#10b981',
  memoria: '#6366f1',
  automazione: '#ec4899',
};

export const NODE_STATE_COLORS: Record<string, string> = {
  bozza: '#94a3b8',
  pronto: '#3b82f6',
  in_esecuzione: '#f59e0b',
  completato: '#10b981',
  bloccato: '#ef4444',
};

export const PROVIDER_IDS = ['openai', 'anthropic', 'gemini', 'ollama'] as const;

export const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Google Gemini',
  ollama: 'Ollama (Locale)',
};

export const CONNECTOR_CATEGORIES = [
  { id: 'ai', label: 'Intelligenza Artificiale' },
  { id: 'dev', label: 'Sviluppo' },
  { id: 'cloud-storage', label: 'Cloud Storage' },
  { id: 'database', label: 'Database' },
  { id: 'messaging', label: 'Messaggistica' },
  { id: 'email', label: 'Email' },
  { id: 'social', label: 'Social Media' },
  { id: 'productivity', label: 'Produttività' },
  { id: 'crm', label: 'CRM' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'automation', label: 'Automazione' },
  { id: 'cms', label: 'CMS' },
] as const;

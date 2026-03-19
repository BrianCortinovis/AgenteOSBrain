import { useState, useEffect } from 'react';
import { useProjectStore } from '../../stores/useProjectStore';
import { api } from '../../api/client';

type WizardStep = {
  question: string;
  options: { label: string; value: string }[];
  allowCustom: boolean;
  key: string;
};

const WIZARD_STEPS: WizardStep[] = [
  {
    key: 'app_description',
    question: 'Che app vuoi creare? Descrivi cosa deve fare.',
    options: [],
    allowCustom: true,
  },
  {
    key: 'style',
    question: 'Che stile grafico preferisci?',
    options: [
      { label: 'Moderno e minimalista (bianco, ombre morbide, angoli arrotondati)', value: 'modern-minimal' },
      { label: 'Dark mode futuristico (sfondo scuro, accenti neon)', value: 'dark-futuristic' },
      { label: 'Colorato e vivace (gradients, colori accesi, playful)', value: 'colorful' },
      { label: 'Corporate / Business (pulito, professionale, blu/grigio)', value: 'corporate' },
      { label: 'Glass morphism (trasparenze, sfocature, elegante)', value: 'glassmorphism' },
    ],
    allowCustom: true,
  },
  {
    key: 'colors',
    question: 'Che palette colori?',
    options: [
      { label: 'Blu + Bianco (professionale)', value: 'blue-white' },
      { label: 'Verde + Scuro (natura/tech)', value: 'green-dark' },
      { label: 'Viola + Rosa (creativo)', value: 'purple-pink' },
      { label: 'Arancione + Nero (energico)', value: 'orange-black' },
      { label: 'Personalizzati (specifica dopo)', value: 'custom' },
      { label: 'Lascia decidere all\'AI', value: 'auto' },
    ],
    allowCustom: true,
  },
  {
    key: 'layout',
    question: 'Che tipo di layout?',
    options: [
      { label: 'Sidebar + Contenuto principale (dashboard style)', value: 'sidebar-content' },
      { label: 'Top navbar + Pagine (sito web classico)', value: 'navbar-pages' },
      { label: 'Full screen singola pagina (app-like)', value: 'single-page' },
      { label: 'Card grid (Pinterest/gallery style)', value: 'card-grid' },
      { label: 'Lascia decidere all\'AI', value: 'auto' },
    ],
    allowCustom: true,
  },
  {
    key: 'features',
    question: 'Quali funzionalita principali? (seleziona o scrivi)',
    options: [
      { label: 'Login / Autenticazione utenti', value: 'auth' },
      { label: 'Database / Salvataggio dati', value: 'database' },
      { label: 'Dashboard con grafici e statistiche', value: 'dashboard' },
      { label: 'CRUD (crea, leggi, modifica, elimina)', value: 'crud' },
      { label: 'Ricerca e filtri avanzati', value: 'search' },
      { label: 'Upload file / immagini', value: 'upload' },
      { label: 'Notifiche / Avvisi', value: 'notifications' },
      { label: 'AI integrata (chat, suggerimenti, analisi)', value: 'ai' },
    ],
    allowCustom: true,
  },
  {
    key: 'tech',
    question: 'Che tecnologia preferisci?',
    options: [
      { label: 'HTML + CSS + JS (semplice, niente build)', value: 'vanilla' },
      { label: 'React + Vite + Tailwind (moderno, veloce)', value: 'react-vite' },
      { label: 'React + Express + SQLite (full stack)', value: 'react-express' },
      { label: 'Next.js + Tailwind (SSR, routing)', value: 'nextjs' },
      { label: 'Lascia decidere all\'AI in base alle funzionalita', value: 'auto' },
    ],
    allowCustom: true,
  },
];

type Props = {
  onComplete: (appName: string) => void;
  onCancel: () => void;
  autoStart?: {
    prompt: string;
    style?: string;
    colors?: string;
    layout?: string;
    features?: string;
    tech?: string;
  };
};

export default function BuilderWizard({ onComplete, onCancel, autoStart }: Props) {
  const { createProject } = useProjectStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(
    autoStart ? {
      app_description: autoStart.prompt,
      style: autoStart.style || 'dark-futuristic',
      colors: autoStart.colors || 'auto',
      layout: autoStart.layout || 'auto',
      features: autoStart.features || 'tutte le funzionalità descritte nel prompt',
      tech: autoStart.tech || 'auto',
    } : {}
  );
  const [customInput, setCustomInput] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
  const [building, setBuilding] = useState(!!autoStart);
  const [buildStatus, setBuildStatus] = useState(autoStart ? 'Avvio build automatica...' : '');

  // Auto-start build when all answers pre-filled
  useEffect(() => {
    if (autoStart && building) {
      handleBuild();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = WIZARD_STEPS[currentStep];
  const isLastStep = currentStep === WIZARD_STEPS.length - 1;
  const isFirstStep = currentStep === 0;
  const isMultiSelect = step.key === 'features';

  const handleSelectOption = (value: string) => {
    if (isMultiSelect) {
      const next = new Set(selectedOptions);
      if (next.has(value)) next.delete(value); else next.add(value);
      setSelectedOptions(next);
    } else {
      setAnswers({ ...answers, [step.key]: value });
      setCustomInput('');
      if (!isLastStep) {
        setCurrentStep(currentStep + 1);
        setSelectedOptions(new Set());
      }
    }
  };

  const handleCustomSubmit = () => {
    if (!customInput.trim()) return;
    setAnswers({ ...answers, [step.key]: customInput.trim() });
    setCustomInput('');
    if (!isLastStep) {
      setCurrentStep(currentStep + 1);
      setSelectedOptions(new Set());
    }
  };

  const handleNext = () => {
    if (isMultiSelect && selectedOptions.size > 0) {
      const labels = Array.from(selectedOptions).map(v => {
        const opt = step.options.find(o => o.value === v);
        return opt ? opt.label : v;
      });
      setAnswers({ ...answers, [step.key]: labels.join(', ') });
    }
    if (!isLastStep) {
      setCurrentStep(currentStep + 1);
      setSelectedOptions(new Set());
    } else {
      handleBuild();
    }
  };

  const handleBuild = async () => {
    setBuilding(true);
    setBuildStatus('Creazione progetto...');

    // Compose the detailed prompt from all answers
    const styleMap: Record<string, string> = {
      'modern-minimal': 'stile moderno e minimalista con sfondo bianco, ombre morbide, angoli arrotondati, font sans-serif pulito',
      'dark-futuristic': 'tema scuro futuristico con sfondo #0a0a0f, accenti neon ciano/viola, bordi luminosi, font monospace per titoli',
      'colorful': 'stile colorato e vivace con gradienti, colori accesi, animazioni, bordi arrotondati grandi',
      'corporate': 'stile corporate professionale con palette blu/grigio, tipografia seria, layout pulito e ordinato',
      'glassmorphism': 'glass morphism con sfondi sfocati trasparenti, bordi sottili bianchi, ombre colorate',
    };

    const colorMap: Record<string, string> = {
      'blue-white': 'palette blu (#3B82F6) e bianco con accenti azzurri',
      'green-dark': 'palette verde (#10B981) su sfondo scuro (#1a1a2e)',
      'purple-pink': 'palette viola (#8B5CF6) e rosa (#EC4899) con gradienti',
      'orange-black': 'palette arancione (#F59E0B) su nero (#111) con accenti rossi',
    };

    const desc = answers.app_description || 'un\'app generica';
    const style = styleMap[answers.style] || answers.style || 'stile moderno e pulito';
    const colors = colorMap[answers.colors] || answers.colors || 'colori decisi dall\'AI';
    const layout = answers.layout === 'auto' ? 'layout deciso dall\'AI' : (answers.layout || 'layout standard');
    const features = answers.features || 'funzionalita base';
    const tech = answers.tech === 'auto' ? 'tecnologia decisa dall\'AI in base alle necessita' : (answers.tech || 'React + Vite');

    const prompt = `Costruiscimi un'app: ${desc}

SPECIFICHE GRAFICHE E DI DESIGN:
- Stile: ${style}
- Colori: ${colors}
- Layout: ${layout}

FUNZIONALITA RICHIESTE:
${features}

TECNOLOGIA: ${tech}

IMPORTANTE: L'interfaccia deve essere BELLA e CURATA, non basic. Usa il design system specificato.
Ogni componente deve avere hover effects, transizioni smooth, icone dove servono.
Il CSS deve essere dettagliato e professionale, non generico.`;

    try {
      setBuildStatus('Creazione progetto e pianificazione...');
      const project = await createProject({ name: desc.slice(0, 40).replace(/[^a-zA-Z0-9 ]/g, '') });

      setBuildStatus('Generazione piano app con AI...');
      await api.post(`/projects/${project.id}/chat`, {
        message: prompt,
        provider_id: 'openai',
        model_id: 'gpt-4o',
      });

      setBuildStatus('Avvio build...');
      await api.post(`/projects/${project.id}/execute`, {});

      setBuildStatus('Build completato!');

      // Find the app name
      const apps = await api.get<any[]>('/apps');
      const newest = apps.sort((a: any, b: any) => b.name.localeCompare(a.name))[0];
      if (newest) {
        onComplete(newest.name);
      }
    } catch (err: any) {
      setBuildStatus(`Errore: ${err.message}`);
    } finally {
      setBuilding(false);
    }
  };

  if (building) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', gap: 16, padding: 32,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          border: '3px solid var(--border-primary)',
          borderTopColor: 'var(--accent-blue)',
          animation: 'spin 1s linear infinite',
        }} />
        <div style={{ fontSize: 14, fontWeight: 600 }}>{buildStatus}</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: 600, margin: '0 auto', padding: '32px 24px',
      display: 'flex', flexDirection: 'column', height: '100%',
    }}>
      {/* Progress */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {WIZARD_STEPS.map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i <= currentStep ? 'var(--accent-blue)' : 'var(--border-primary)',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      {/* Step counter */}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
        Passo {currentStep + 1} di {WIZARD_STEPS.length}
      </div>

      {/* Question */}
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px 0' }}>
        {step.question}
      </h2>

      {/* Options */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {step.options.map(opt => {
          const isSelected = isMultiSelect ? selectedOptions.has(opt.value) : answers[step.key] === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => handleSelectOption(opt.value)}
              style={{
                padding: '12px 16px', textAlign: 'left',
                borderRadius: 10,
                border: isSelected ? '2px solid var(--accent-blue)' : '1px solid var(--border-primary)',
                background: isSelected ? 'rgba(59,130,246,0.1)' : 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: 13, cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {isMultiSelect && (
                <span style={{
                  display: 'inline-block', width: 16, height: 16, marginRight: 8,
                  borderRadius: 3, border: '1px solid var(--border-primary)',
                  background: isSelected ? 'var(--accent-blue)' : 'transparent',
                  verticalAlign: 'middle', textAlign: 'center', lineHeight: '14px',
                  color: 'white', fontSize: 11,
                }}>
                  {isSelected ? '✓' : ''}
                </span>
              )}
              {opt.label}
            </button>
          );
        })}

        {/* Custom input */}
        {step.allowCustom && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCustomSubmit()}
              placeholder={isFirstStep ? 'Descrivi la tua app...' : 'Oppure scrivi la tua risposta...'}
              style={{
                flex: 1, padding: '10px 14px', fontSize: 13,
                borderRadius: 10, border: '1px solid var(--border-primary)',
                background: 'var(--bg-input)',
              }}
            />
            {customInput.trim() && (
              <button
                onClick={handleCustomSubmit}
                className="btn btn-primary btn-sm"
                style={{ borderRadius: 10, padding: '8px 16px' }}
              >
                OK
              </button>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-primary)' }}>
        <button
          onClick={isFirstStep ? onCancel : () => { setCurrentStep(currentStep - 1); setSelectedOptions(new Set()); }}
          style={{
            padding: '8px 20px', borderRadius: 8, fontSize: 13,
            background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
            cursor: 'pointer', color: 'var(--text-secondary)',
          }}
        >
          {isFirstStep ? 'Annulla' : 'Indietro'}
        </button>
        <button
          onClick={handleNext}
          disabled={!answers[step.key] && selectedOptions.size === 0 && !customInput.trim()}
          className="btn btn-primary"
          style={{
            padding: '8px 24px', borderRadius: 8, fontSize: 13,
            opacity: (!answers[step.key] && selectedOptions.size === 0 && !customInput.trim()) ? 0.4 : 1,
          }}
        >
          {isLastStep ? 'Costruisci App' : 'Avanti'}
        </button>
      </div>
    </div>
  );
}

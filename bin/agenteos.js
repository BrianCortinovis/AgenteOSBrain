#!/usr/bin/env node

/**
 * Agent OS Brain - CLI Launcher
 *
 * Usage:
 *   npx agenteos              # Start the platform
 *   npx agenteos --port 8080  # Start on custom port
 *   npx agenteos onboard      # Guided setup wizard
 *   npx agenteos status       # Check system status
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const args = process.argv.slice(2);
const command = args[0] || 'start';

const LOGO = `
  ╔═══════════════════════════════════╗
  ║     🧠 Agent OS Brain v0.1.0     ║
  ║   Orchestrazione IA Visuale       ║
  ╚═══════════════════════════════════╝
`;

async function main() {
  switch (command) {
    case 'start':
      await startServer();
      break;
    case 'onboard':
      await onboard();
      break;
    case 'status':
      showStatus();
      break;
    case '--help':
    case '-h':
      showHelp();
      break;
    default:
      console.log(`Comando sconosciuto: ${command}`);
      showHelp();
  }
}

async function startServer() {
  console.log(LOGO);

  const portArg = args.indexOf('--port');
  const port = portArg >= 0 ? args[portArg + 1] : process.env.PORT || '3001';

  const backendDir = path.resolve(__dirname, '../backend');
  const frontendDir = path.resolve(__dirname, '../frontend');

  // Check if dependencies are installed
  if (!fs.existsSync(path.join(backendDir, 'node_modules'))) {
    console.log('[Setup] Installazione dipendenze backend...');
    execSync('npm install', { cwd: backendDir, stdio: 'inherit' });
  }
  if (!fs.existsSync(path.join(frontendDir, 'node_modules'))) {
    console.log('[Setup] Installazione dipendenze frontend...');
    execSync('npm install', { cwd: frontendDir, stdio: 'inherit' });
  }

  console.log(`[Agent OS] Avvio backend su porta ${port}...`);
  console.log(`[Agent OS] Avvio frontend su porta 5173...`);
  console.log('');

  // Start both servers
  const backend = spawn('npx', ['tsx', 'src/index.ts'], {
    cwd: backendDir,
    env: { ...process.env, PORT: port },
    stdio: 'inherit',
  });

  const frontend = spawn('npx', ['vite', '--host'], {
    cwd: frontendDir,
    stdio: 'inherit',
  });

  process.on('SIGINT', () => {
    backend.kill();
    frontend.kill();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    backend.kill();
    frontend.kill();
    process.exit(0);
  });
}

async function onboard() {
  console.log(LOGO);
  console.log('Benvenuto in Agent OS Brain! Configuriamo il tuo ambiente.\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

  const envPath = path.resolve(__dirname, '../.env');
  const envLines = [];

  // OpenAI
  const openaiKey = await ask('OpenAI API Key (lascia vuoto per saltare): ');
  if (openaiKey.trim()) envLines.push(`OPENAI_API_KEY=${openaiKey.trim()}`);

  // Anthropic
  const anthropicKey = await ask('Anthropic API Key (lascia vuoto per saltare): ');
  if (anthropicKey.trim()) envLines.push(`ANTHROPIC_API_KEY=${anthropicKey.trim()}`);

  // Gemini
  const geminiKey = await ask('Google Gemini API Key (lascia vuoto per saltare): ');
  if (geminiKey.trim()) envLines.push(`GEMINI_API_KEY=${geminiKey.trim()}`);

  // DeepSeek
  const deepseekKey = await ask('DeepSeek API Key (lascia vuoto per saltare): ');
  if (deepseekKey.trim()) envLines.push(`DEEPSEEK_API_KEY=${deepseekKey.trim()}`);

  // OpenRouter
  const openrouterKey = await ask('OpenRouter API Key (lascia vuoto per saltare): ');
  if (openrouterKey.trim()) envLines.push(`OPENROUTER_API_KEY=${openrouterKey.trim()}`);

  // Port
  const port = await ask('Porta backend (default: 3001): ');
  if (port.trim()) envLines.push(`PORT=${port.trim()}`);

  rl.close();

  if (envLines.length > 0) {
    fs.writeFileSync(envPath, envLines.join('\n') + '\n', 'utf-8');
    console.log(`\nConfigurazione salvata in ${envPath}`);
  }

  console.log('\nSetup completato! Avvia Agent OS con:');
  console.log('  npx agenteos start\n');
}

function showStatus() {
  console.log(LOGO);
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, 'utf-8');
    console.log('Configurazione:');
    for (const line of env.split('\n').filter(Boolean)) {
      const [key, val] = line.split('=');
      console.log(`  ${key}: ${val ? '...' + val.slice(-6) : '(vuoto)'}`);
    }
  } else {
    console.log('Nessuna configurazione trovata. Esegui: npx agenteos onboard');
  }

  // Check node_modules
  const backendModules = fs.existsSync(path.resolve(__dirname, '../backend/node_modules'));
  const frontendModules = fs.existsSync(path.resolve(__dirname, '../frontend/node_modules'));
  console.log(`\nDipendenze:`);
  console.log(`  Backend:  ${backendModules ? 'OK' : 'Non installate'}`);
  console.log(`  Frontend: ${frontendModules ? 'OK' : 'Non installate'}`);
}

function showHelp() {
  console.log(LOGO);
  console.log('Uso: npx agenteos [comando] [opzioni]\n');
  console.log('Comandi:');
  console.log('  start          Avvia la piattaforma (default)');
  console.log('  onboard        Wizard di configurazione guidata');
  console.log('  status         Mostra stato del sistema');
  console.log('  --help, -h     Mostra questo aiuto\n');
  console.log('Opzioni:');
  console.log('  --port <N>     Porta del backend (default: 3001)\n');
}

main().catch(console.error);

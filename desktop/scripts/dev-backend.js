#!/usr/bin/env node
/**
 * Dev mode: starts the backend for Tauri dev
 */
const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

const backend = spawn('npx', ['tsx', 'watch', 'backend/src/index.ts'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, PORT: '43101' },
});

backend.on('close', (code) => {
  console.log(`Backend exited with code ${code}`);
});

process.on('SIGTERM', () => backend.kill());
process.on('SIGINT', () => backend.kill());

/**
 * Generate a default database with all demo projects, agents, and skills.
 * This DB gets bundled into the Electron app as the starter database.
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const DB_DIR = path.join(__dirname, 'default-data');
const DB_PATH = path.join(DB_DIR, 'agenteos.db');

// Clean
if (fs.existsSync(DB_DIR)) fs.rmSync(DB_DIR, { recursive: true });
fs.mkdirSync(DB_DIR, { recursive: true });

// Set env so seeds write to our default DB
process.env.AGENT_OS_DB_PATH = DB_PATH;
process.env.AGENT_OS_DATA_DIR = DB_DIR;

const npx = 'npx';
const opts = { cwd: ROOT, stdio: 'inherit', env: { ...process.env, AGENT_OS_DB_PATH: DB_PATH, AGENT_OS_DATA_DIR: DB_DIR } };

console.log('\n[Seed] Creating default database...\n');

// Run all seed scripts
const seeds = [
  'backend/src/seed-demo.ts',
  'backend/src/seed-editorial.ts',
  'backend/src/seed-skills.ts',
  'backend/src/seed-form-filler.ts',
];

for (const seed of seeds) {
  const seedPath = path.join(ROOT, seed);
  if (fs.existsSync(seedPath)) {
    console.log(`[Seed] Running ${seed}...`);
    try {
      execSync(`${npx} tsx ${seed}`, opts);
    } catch (e) {
      console.warn(`[Seed] Warning: ${seed} failed, continuing...`);
    }
  }
}

const size = fs.statSync(DB_PATH).size;
console.log(`\n[Seed] ✅ Default database created: ${(size / 1024).toFixed(0)}KB`);
console.log(`[Seed] Path: ${DB_PATH}\n`);

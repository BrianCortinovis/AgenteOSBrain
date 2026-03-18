/**
 * Pre-build: bundle backend + copy frontend dist
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEST = __dirname;

console.log('[Build] Bundling backend with esbuild...');

// Bundle backend into a single JS file
require('esbuild').buildSync({
  entryPoints: [path.join(ROOT, 'backend/src/index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: path.join(DEST, 'backend-bundle.js'),
  format: 'cjs',
  sourcemap: false,
  minify: true,
  external: [
    'better-sqlite3',
    'electron',
    // Keep native modules external
    'fsevents',
    'cpu-features',
  ],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  // Handle __dirname correctly
  banner: {
    js: `
      const __bundle_dirname = typeof __dirname !== 'undefined' ? __dirname : '';
    `,
  },
});

console.log('[Build] Backend bundled → backend-bundle.js');

// Copy frontend dist
console.log('[Build] Copying frontend dist...');
const frontendSrc = path.join(ROOT, 'frontend/dist');
const frontendDest = path.join(DEST, 'frontend-dist');

if (fs.existsSync(frontendSrc)) {
  // Remove old
  if (fs.existsSync(frontendDest)) {
    fs.rmSync(frontendDest, { recursive: true });
  }
  // Copy
  fs.cpSync(frontendSrc, frontendDest, { recursive: true });
  console.log('[Build] Frontend copied → frontend-dist/');
} else {
  console.log('[Build] Building frontend first...');
  execSync('npm run build -w frontend', { cwd: ROOT, stdio: 'inherit' });
  fs.cpSync(frontendSrc, frontendDest, { recursive: true });
  console.log('[Build] Frontend built and copied');
}

// Copy migrations
console.log('[Build] Copying migrations...');
const migrationsSrc = path.join(ROOT, 'backend/src/database/migrations');
const migrationsDest = path.join(DEST, 'migrations');
if (fs.existsSync(migrationsSrc)) {
  if (fs.existsSync(migrationsDest)) fs.rmSync(migrationsDest, { recursive: true });
  fs.cpSync(migrationsSrc, migrationsDest, { recursive: true });
}

// Copy connector definitions (loaded at runtime via readFileSync)
console.log('[Build] Copying connector definitions...');
const connDefSrc = path.join(ROOT, 'backend/src/modules/connectors/definitions');
const connDefDest = path.join(DEST, 'definitions');
if (fs.existsSync(connDefSrc)) {
  if (fs.existsSync(connDefDest)) fs.rmSync(connDefDest, { recursive: true });
  fs.cpSync(connDefSrc, connDefDest, { recursive: true });
}

// Copy icons
const iconsSrc = path.join(ROOT, 'desktop/src-tauri/icons');
const iconsDest = path.join(DEST, 'icons');
if (fs.existsSync(iconsSrc) && !fs.existsSync(iconsDest)) {
  fs.cpSync(iconsSrc, iconsDest, { recursive: true });
}

console.log('[Build] ✅ Pre-build complete!');

#!/usr/bin/env node
/**
 * Build script for Tauri desktop app:
 * 1. Build frontend → desktop/frontend-dist/
 * 2. Bundle backend → single JS via esbuild
 * 3. Download Node.js runtime → embedded in app
 * 4. Create smart runner script
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DESKTOP = path.resolve(__dirname, '..');
const FRONTEND_DIST = path.join(DESKTOP, 'frontend-dist');
const BIN_DIR = path.join(DESKTOP, 'src-tauri', 'bin');

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...opts });
}

function step(msg) {
  console.log(`\n${'='.repeat(60)}\n  ${msg}\n${'='.repeat(60)}`);
}

// ─── Step 1: Build frontend ───
step('1/5 Building frontend...');
run('npm run build -w frontend');

if (fs.existsSync(FRONTEND_DIST)) {
  fs.rmSync(FRONTEND_DIST, { recursive: true });
}
fs.cpSync(path.join(ROOT, 'frontend', 'dist'), FRONTEND_DIST, { recursive: true });

// Inject API base URL
const indexHtml = path.join(FRONTEND_DIST, 'index.html');
let html = fs.readFileSync(indexHtml, 'utf8');
html = html.replace(
  '</head>',
  `<script>window.__AGENTEOS_API_BASE__ = 'http://localhost:43101';</script>\n</head>`
);
fs.writeFileSync(indexHtml, html);
console.log('Frontend built and configured for desktop mode');

// ─── Step 2: Bundle backend ───
step('2/5 Bundling backend with esbuild...');

run('npm run build -w shared 2>/dev/null || true');

const esbuildOut = path.join(BIN_DIR, 'backend-bundle.cjs');
fs.mkdirSync(BIN_DIR, { recursive: true });

run(`npx esbuild backend/src/index.ts \
  --bundle \
  --platform=node \
  --target=node20 \
  --outfile=${esbuildOut} \
  --format=cjs \
  --external:better-sqlite3 \
  --external:cpu-features \
  --external:ssh2 \
  --loader:.node=file \
  --define:process.env.NODE_ENV='"production"'`);

// ─── Step 3: Download Node.js ───
step('3/5 Downloading Node.js runtime...');
run(`node ${path.join(DESKTOP, 'scripts', 'download-node.js')}`);

// ─── Step 4: Create smart runner script ───
step('4/5 Creating standalone runner...');

const arch = process.arch === 'arm64' ? 'aarch64' : 'x86_64';
const runnerPath = path.join(BIN_DIR, `agenteos-backend-${arch}-apple-darwin`);

// This runner:
// 1. Checks for system Node.js (already installed by user)
// 2. If not found, uses the bundled Node.js (inside the .app)
// 3. Runs the backend bundle
const runner = `#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  Agent OS Brain — Backend Sidecar (Standalone)
#  Finds the best Node.js available and runs the backend
# ═══════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUNDLE="$SCRIPT_DIR/backend-bundle.cjs"
MIN_NODE_VERSION=18

# ─── Find Node.js ───
# Priority: system node > homebrew node > nvm node > bundled node
find_node() {
  local candidates=(
    "$(command -v node 2>/dev/null)"
    "/usr/local/bin/node"
    "/opt/homebrew/bin/node"
  )

  # Add nvm versions if available
  if [ -d "$HOME/.nvm/versions/node" ]; then
    for d in $(ls -r "$HOME/.nvm/versions/node" 2>/dev/null); do
      candidates+=("$HOME/.nvm/versions/node/$d/bin/node")
    done
  fi

  # Add fnm versions if available
  if [ -d "$HOME/Library/Application Support/fnm/node-versions" ]; then
    for d in $(ls -r "$HOME/Library/Application Support/fnm/node-versions" 2>/dev/null); do
      candidates+=("$HOME/Library/Application Support/fnm/node-versions/$d/installation/bin/node")
    done
  fi

  # Add volta versions if available
  if [ -d "$HOME/.volta/tools/image/node" ]; then
    for d in $(ls -r "$HOME/.volta/tools/image/node" 2>/dev/null); do
      candidates+=("$HOME/.volta/tools/image/node/$d/bin/node")
    done
  fi

  # Try each candidate
  for node_path in "\${candidates[@]}"; do
    if [ -n "$node_path" ] && [ -x "$node_path" ]; then
      local ver=$("$node_path" -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
      if [ -n "$ver" ] && [ "$ver" -ge "$MIN_NODE_VERSION" ] 2>/dev/null; then
        echo "$node_path"
        return 0
      fi
    fi
  done

  return 1
}

NODE_BIN=""

# Try system Node first
NODE_BIN=$(find_node)

if [ -n "$NODE_BIN" ]; then
  NODE_VER=$("$NODE_BIN" -v 2>/dev/null)
  echo "[AgentOS] Using system Node.js $NODE_VER at $NODE_BIN"
else
  # Fallback: bundled Node.js inside the app
  # When running inside .app bundle, the resources are here:
  BUNDLED_NODE=""

  # Check various locations where Tauri puts resources
  for candidate in \\
    "$SCRIPT_DIR/node" \\
    "$SCRIPT_DIR/../Resources/bin/node" \\
    "$SCRIPT_DIR/../../Resources/bin/node" \\
    "$(dirname "$SCRIPT_DIR")/Resources/bin/node"; do
    if [ -x "$candidate" ]; then
      BUNDLED_NODE="$candidate"
      break
    fi
  done

  if [ -n "$BUNDLED_NODE" ]; then
    NODE_BIN="$BUNDLED_NODE"
    echo "[AgentOS] No system Node.js found — using bundled runtime"
  else
    echo "[AgentOS] ERROR: No Node.js found!" >&2
    echo "[AgentOS] Install Node.js 18+: https://nodejs.org/" >&2
    echo "[AgentOS] Or: brew install node" >&2

    # Last resort: try to open a dialog (macOS)
    if command -v osascript &>/dev/null; then
      osascript -e 'display dialog "Node.js non trovato!\\n\\nAgent OS Brain richiede Node.js 18+.\\n\\nInstalla da: https://nodejs.org/" buttons {"OK"} default button 1 with icon caution with title "Agent OS Brain"' 2>/dev/null
    fi
    exit 1
  fi
fi

# ─── Setup native modules ───
# better-sqlite3 needs to find its .node addon
export NODE_PATH="$SCRIPT_DIR:$SCRIPT_DIR/build/Release:$NODE_PATH"

# ─── Run backend ───
exec "$NODE_BIN" "$BUNDLE" "$@"
`;

fs.writeFileSync(runnerPath, runner, { mode: 0o755 });
console.log(`Runner created: ${runnerPath}`);

// ─── Step 5: Copy native modules ───
step('5/5 Copying native modules...');

const sqlitePaths = [
  path.join(ROOT, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'),
  path.join(ROOT, 'node_modules', 'better-sqlite3', 'prebuilds', `darwin-${process.arch}`, 'better_sqlite3.node'),
];

let sqliteCopied = false;
for (const p of sqlitePaths) {
  if (fs.existsSync(p)) {
    // Copy to multiple locations so require() finds it
    fs.copyFileSync(p, path.join(BIN_DIR, 'better_sqlite3.node'));

    const bindingDir = path.join(BIN_DIR, 'build', 'Release');
    fs.mkdirSync(bindingDir, { recursive: true });
    fs.copyFileSync(p, path.join(bindingDir, 'better_sqlite3.node'));

    console.log(`Copied native SQLite from ${p}`);
    sqliteCopied = true;
    break;
  }
}
if (!sqliteCopied) {
  console.warn('WARNING: better-sqlite3 native module not found!');
}

// Copy migrations
const migrationsSource = path.join(ROOT, 'backend', 'src', 'database', 'migrations');
const migrationsDest = path.join(BIN_DIR, 'migrations');
if (fs.existsSync(migrationsSource)) {
  if (fs.existsSync(migrationsDest)) fs.rmSync(migrationsDest, { recursive: true });
  fs.cpSync(migrationsSource, migrationsDest, { recursive: true });
  console.log('Migrations copied');
}

// ─── Summary ───
step('Build complete!');

const files = fs.readdirSync(BIN_DIR).map(f => {
  const stat = fs.statSync(path.join(BIN_DIR, f));
  return { name: f, size: `${(stat.size / 1024 / 1024).toFixed(1)}MB`, isDir: stat.isDirectory() };
}).filter(f => !f.isDir);

console.log('\nBundled files:');
files.forEach(f => console.log(`  ${f.name.padEnd(50)} ${f.size}`));
console.log(`\nFrontend: ${FRONTEND_DIST}`);
console.log(`Runner:   ${runnerPath}`);
console.log(`\nNext: cd desktop/src-tauri && cargo tauri build --target ${arch}-apple-darwin`);

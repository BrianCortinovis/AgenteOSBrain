#!/usr/bin/env node
/**
 * Downloads a standalone Node.js binary for the target platform
 * and places it inside src-tauri/bin/ so Tauri bundles it with the app.
 *
 * Node.js provides official standalone builds since v20:
 * https://nodejs.org/dist/
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const NODE_VERSION = '22.20.0';
const DEST_DIR = path.resolve(__dirname, '..', 'src-tauri', 'bin');

function getNodeUrl() {
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const platform = process.platform === 'darwin' ? 'darwin' : 'linux';
  return {
    url: `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-${platform}-${arch}.tar.gz`,
    extracted: `node-v${NODE_VERSION}-${platform}-${arch}`,
    arch,
    platform,
  };
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`  Downloading: ${url}`);
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        download(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      const total = parseInt(response.headers['content-length'] || '0', 10);
      let downloaded = 0;
      response.on('data', (chunk) => {
        downloaded += chunk.length;
        if (total > 0) {
          const pct = ((downloaded / total) * 100).toFixed(0);
          process.stdout.write(`\r  Progress: ${pct}% (${(downloaded / 1024 / 1024).toFixed(1)}MB)`);
        }
      });
      response.pipe(file);
      file.on('finish', () => { file.close(); console.log(''); resolve(); });
    }).on('error', reject);
  });
}

async function main() {
  const { url, extracted, arch, platform } = getNodeUrl();
  const tarPath = path.join('/tmp', `node-${NODE_VERSION}.tar.gz`);
  const extractDir = path.join('/tmp', 'node-extract');

  console.log(`\n[download-node] Node.js v${NODE_VERSION} for ${platform}-${arch}`);

  // Download if not cached
  if (!fs.existsSync(tarPath)) {
    await download(url, tarPath);
  } else {
    console.log(`  Using cached: ${tarPath}`);
  }

  // Extract
  console.log('  Extracting...');
  if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true });
  fs.mkdirSync(extractDir, { recursive: true });
  execSync(`tar -xzf "${tarPath}" -C "${extractDir}"`, { stdio: 'pipe' });

  // Copy just the node binary (not the entire runtime - saves ~60MB)
  const nodeBin = path.join(extractDir, extracted, 'bin', 'node');
  const destFile = path.join(DEST_DIR, 'node');

  if (!fs.existsSync(nodeBin)) {
    console.error(`  ERROR: node binary not found at ${nodeBin}`);
    process.exit(1);
  }

  fs.mkdirSync(DEST_DIR, { recursive: true });
  fs.copyFileSync(nodeBin, destFile);
  fs.chmodSync(destFile, 0o755);

  const size = (fs.statSync(destFile).size / 1024 / 1024).toFixed(1);
  console.log(`  Copied: ${destFile} (${size}MB)`);

  // Cleanup
  fs.rmSync(extractDir, { recursive: true });

  console.log('[download-node] Done!\n');
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});

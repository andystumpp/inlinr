#!/usr/bin/env node
/**
 * VSIX activation smoke test.
 *
 * Verifies that activation-critical runtime dependencies and assets are present
 * in the packaged VSIX artifact. Fails loudly when required modules or prompt
 * assets are missing so that packaging/activation gaps are caught before publish.
 *
 * Usage: node scripts/verify-vsix.mjs [path/to/inlinr.vsix]
 * Defaults to dist/inlinr.vsix when no path is given.
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(import.meta.url), '../..');
const vsixPath = process.argv[2] ?? path.join(repoRoot, 'dist', 'inlinr.vsix');

/**
 * Files that must be present inside the VSIX for the extension to activate.
 *
 * - extension/out/src/extension.js       — compiled entry point (bundled by esbuild)
 * - @azure/monitor-opentelemetry-exporter — kept external from the bundle and loaded
 *   at runtime via createRequire + absolute path resolution; both the package root and
 *   the two private generated API modules must be shipped.
 * - prompts/selection-scoped-edit.md     — prompt template read from disk during the
 *   selection-scoped edit request flow.
 */
const REQUIRED_FILES = [
  'extension/out/src/extension.js',
  'extension/node_modules/@azure/monitor-opentelemetry-exporter/package.json',
  'extension/node_modules/@azure/monitor-opentelemetry-exporter/dist/commonjs/generated/api/index.js',
  'extension/node_modules/@azure/monitor-opentelemetry-exporter/dist/commonjs/generated/api/operations.js',
  'extension/prompts/selection-scoped-edit.md',
];

// ---------------------------------------------------------------------------

if (!existsSync(vsixPath)) {
  console.error(`ERROR: VSIX not found at ${vsixPath}`);
  console.error('Run `npm run package:vsix` first.');
  process.exit(1);
}

console.log(`Smoke-testing VSIX: ${vsixPath}\n`);

// List all file entries in the VSIX (which is a ZIP archive).
let listing;
try {
  listing = execSync(`unzip -l "${vsixPath}"`, { encoding: 'utf8' });
} catch (err) {
  console.error('ERROR: Could not list VSIX contents. Ensure `unzip` is installed.');
  console.error(err.message);
  process.exit(1);
}

// The `unzip -l` output has one file per line in the form:
//   <size>  <date> <time>   <path>
// We only parse lines that start with a numeric size field (actual file entries)
// to avoid treating header and summary lines as file paths.
const FILE_ENTRY_RE = /^\s*\d+\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+(.+)$/;

const vsixEntries = new Set(
  listing
    .split('\n')
    .map(line => FILE_ENTRY_RE.exec(line)?.[1]?.trim())
    .filter(Boolean)
);

const missing = REQUIRED_FILES.filter(f => !vsixEntries.has(f));

if (missing.length > 0) {
  console.error('VSIX smoke test FAILED. Missing activation-critical file(s):');
  for (const file of missing) {
    console.error(`  ✗ ${file}`);
  }
  process.exit(1);
}

console.log('VSIX smoke test passed. All activation-critical files are present:');
for (const file of REQUIRED_FILES) {
  console.log(`  ✓ ${file}`);
}

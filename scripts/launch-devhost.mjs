import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, '..');
const fixtureWorkspacePath = path.join(workspaceRoot, 'tests', 'fixtures', 'workspace');
const baseDir = path.join(os.tmpdir(), 'inlinr-devhost-profile-');
const userDataDir = mkdtempSync(baseDir);

const command = [
  'code',
  '--new-window',
  '--disable-extensions',
  `--user-data-dir="${userDataDir}"`,
  `--extensionDevelopmentPath="${workspaceRoot}"`,
  `--folder-uri="${pathToFileURL(fixtureWorkspacePath).href}"`
].join(' ');

const child = spawn(command, {
  stdio: 'inherit',
  shell: true
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error('Failed to launch VS Code dev host:', error.message);
  process.exit(1);
});

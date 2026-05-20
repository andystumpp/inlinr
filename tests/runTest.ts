import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runTests } from '@vscode/test-electron';

async function ensureTestRootPath(targetPath: string): Promise<string> {
  if (process.platform !== 'win32' || !targetPath.includes(' ')) {
    return targetPath;
  }

  const junctionPath = path.join(os.tmpdir(), 'inlinr-vscode-test-root');

  await fs.rm(junctionPath, { recursive: true, force: true });
  await fs.symlink(targetPath, junctionPath, 'junction');

  return junctionPath;
}

async function main(): Promise<void> {
  const suite = process.argv[2] ?? 'integration';
  const configPath = path.resolve(__dirname, '..', '..', '.vscode-test.mjs');
  const configModule = await import(pathToFileURL(configPath).href);
  const extensionDevelopmentPath = await ensureTestRootPath(configModule.extensionDevelopmentPath);
  const extensionTestsPath = path.join(
    extensionDevelopmentPath,
    'out',
    'tests',
    suite === 'unit' ? 'unit' : 'integration',
    'index.js'
  );
  const workspacePath = path.join(extensionDevelopmentPath, 'tests', 'fixtures', 'workspace');

  await runTests({
    extensionDevelopmentPath,
    extensionTestsPath,
    launchArgs: [workspacePath, '--disable-extensions']
  });
}

main().catch((error) => {
  console.error('Failed to run VS Code integration tests.');
  console.error(error);
  process.exit(1);
});
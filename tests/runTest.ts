import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { TestRunFailedError, runTests } from '@vscode/test-electron';
import { buildVsCodeLaunchArgs } from './vscodeLaunchArgs';

async function ensureTestRootPath(targetPath: string): Promise<string> {
  if (process.platform !== 'win32' || !targetPath.includes(' ')) {
    return targetPath;
  }

  const junctionPath = path.join(os.tmpdir(), 'inlinr-vscode-test-root');

  await fs.rm(junctionPath, { recursive: true, force: true });
  await fs.symlink(targetPath, junctionPath, 'junction');

  return junctionPath;
}

async function runSuite(options: {
  extensionDevelopmentPath: string;
  extensionTestsPath: string;
  workspacePath: string;
  version?: 'insiders';
}): Promise<void> {
  await runTests({
    extensionDevelopmentPath: options.extensionDevelopmentPath,
    extensionTestsPath: options.extensionTestsPath,
    launchArgs: buildVsCodeLaunchArgs(options.workspacePath),
    ...(options.version ? { version: options.version } : {})
  });
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

  try {
    await runSuite({
      extensionDevelopmentPath,
      extensionTestsPath,
      workspacePath
    });
  } catch (error) {
    if (!(error instanceof TestRunFailedError) || process.platform !== 'win32') {
      throw error;
    }

    console.warn('Primary VS Code test host failed on Windows startup. Retrying with VS Code Insiders.');

    await runSuite({
      extensionDevelopmentPath,
      extensionTestsPath,
      workspacePath,
      version: 'insiders'
    });
  }
}

main().catch((error) => {
  console.error('Failed to run VS Code integration tests.');
  console.error(error);
  process.exit(1);
});
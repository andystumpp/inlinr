import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export const extensionDevelopmentPath = rootDir;
export const integrationTestsPath = path.join(rootDir, 'out', 'tests', 'integration', 'index.js');
export const unitTestsPath = path.join(rootDir, 'out', 'tests', 'unit', 'index.js');
export const workspacePath = path.join(rootDir, 'tests', 'fixtures', 'workspace');

export default {
  extensionDevelopmentPath,
  integrationTestsPath,
  unitTestsPath,
  launchArgs: [workspacePath, '--disable-extensions']
};
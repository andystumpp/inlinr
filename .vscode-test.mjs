import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export const extensionDevelopmentPath = rootDir;
export const integrationTestsPath = path.join(rootDir, 'out', 'tests', 'integration', 'index.js');
export const unitTestsPath = path.join(rootDir, 'out', 'tests', 'unit', 'index.js');
export const workspacePath = path.join(rootDir, 'tests', 'fixtures', 'workspace');

export default {
  extensionDevelopmentPath,
  integrationTestsPath,
  unitTestsPath,
  // Keep the workspace in a flag instead of a positional path so Windows test
  // launches do not treat the fixture folder as the entry module.
  launchArgs: [`--folder-uri=${pathToFileURL(workspacePath).href}`, '--disable-extensions']
};
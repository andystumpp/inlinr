import { pathToFileURL } from 'node:url';

export function buildVsCodeLaunchArgs(workspacePath: string): string[] {
  // Use --folder-uri instead of a bare workspace path. When the VS Code test
  // host is spawned through the Windows shell, a positional folder path can be
  // treated as the entry module and fail before the test runner loads.
  return [`--folder-uri=${pathToFileURL(workspacePath).href}`, '--disable-extensions'];
}

import assert from 'node:assert/strict';
import { buildVsCodeLaunchArgs } from '../vscodeLaunchArgs';

suite('VS Code launch args', () => {
  test('opens the workspace through folder-uri instead of a positional path', () => {
    const workspacePath = '/tmp/inlinr test workspace';

    const args = buildVsCodeLaunchArgs(workspacePath);

    assert.deepEqual(args, [
      '--folder-uri=file:///tmp/inlinr%20test%20workspace',
      '--disable-extensions'
    ]);
    assert.ok(!args.includes(workspacePath));
  });
});

import fs from 'node:fs/promises';
import path from 'node:path';
import Mocha from 'mocha';

async function collectTestFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return collectTestFiles(entryPath);
      }

      if (entry.isFile() && entry.name.endsWith('.test.js')) {
        return [entryPath];
      }

      return [];
    })
  );

  return files.flat().sort();
}

export async function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 30000
  });

  const testFiles = await collectTestFiles(__dirname);

  for (const testFile of testFiles) {
    mocha.addFile(testFile);
  }

  await new Promise<void>((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${failures} unit test(s) failed.`));
        return;
      }

      resolve();
    });
  });
}
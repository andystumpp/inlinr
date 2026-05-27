/**
 * esbuild bundle script for the Inlinr VS Code extension.
 *
 * The @azure/monitor-opentelemetry-exporter is marked external because the
 * telemetry sink loads its private internal modules at runtime via dynamic
 * createRequire + absolute path resolution. It must remain in node_modules
 * alongside the bundle and cannot be statically inlined.
 *
 * All other runtime dependencies (markdown-it, mermaid) are bundled.
 */

import * as esbuild from 'esbuild';

const isProd = process.argv.includes('--production');

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'out/src/extension.js',
  external: [
    'vscode',
    '@azure/monitor-opentelemetry-exporter'
  ],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: !isProd,
  minify: isProd,
  logLevel: 'info'
};

await esbuild.build(options);

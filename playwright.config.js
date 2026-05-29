const path = require('node:path');
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: path.join(__dirname, 'tests', 'webview'),
  testMatch: '*.test.js',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: 'list',
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: {
      width: 1280,
      height: 900
    }
  }
});

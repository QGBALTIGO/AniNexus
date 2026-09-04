import { defineConfig, devices } from '@playwright/test';

const chromiumExecutablePath=process.env.ANINEXUS_CHROMIUM_EXECUTABLE_PATH||undefined;
const chromiumArgs=process.env.ANINEXUS_MAP_PAGES_HOST==='1'?['--host-resolver-rules=MAP qgbaltigo.github.io 127.0.0.1']:[];
const firefoxUserPrefs=process.env.ANINEXUS_MAP_PAGES_HOST==='1'?{'network.dns.localDomains':'qgbaltigo.github.io'}:{};

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    serviceWorkers: 'block',
    colorScheme: 'dark',
    locale: 'pt-BR',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, launchOptions: { args:chromiumArgs, ...(chromiumExecutablePath?{executablePath:chromiumExecutablePath}:{}) } } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 }, launchOptions: { firefoxUserPrefs } } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } } },
  ],
});

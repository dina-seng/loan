// Visual/responsive QA helper. Requires the dev servers to be running.
// Run: npm run dev   (in another terminal), then: node scripts/qa-responsive.mjs
import { chromium } from 'playwright-core';

const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const widths = [320, 375, 390, 768, 1024, 1440];
const base = process.env.QA_URL || 'http://127.0.0.1:5173';
const out = process.env.QA_OUT || 'C:\\Users\\ADMIN\\AppData\\Local\\Temp\\opencode';

const browser = await chromium.launch({ executablePath: edge, headless: true });
let failed = false;

for (const width of widths) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(`${base}/login`);
  await page.fill('input[autocomplete="username"]', 'dad');
  await page.fill('input[autocomplete="current-password"]', 'change-me-123');
  await page.click('button[type="submit"]');
  await page.waitForSelector('[data-testid="balance-amount"]', { timeout: 15000 });
  await page.screenshot({ path: `${out}\\dashboard-${width}.png`, fullPage: true });
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    balance: document.querySelector('[data-testid="balance-amount"]')?.textContent,
    navVisible: getComputedStyle(document.querySelector('nav.fixed')).display,
  }));
  const overflow = metrics.scrollWidth > metrics.clientWidth;
  if (overflow) failed = true;
  console.log(`${width}px | overflow=${overflow} (${metrics.scrollWidth}/${metrics.clientWidth}) | balance=${metrics.balance} | mobileNav=${metrics.navVisible}`);
  await page.close();
}

await browser.close();
if (failed) process.exitCode = 1;

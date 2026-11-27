// Mobile QA across all pages. Requires dev servers running.
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 320, height: 800 } });
await page.goto('http://127.0.0.1:5173/login');
await page.fill('input[autocomplete="username"]', 'dad');
await page.fill('input[autocomplete="current-password"]', 'change-me-123');
await page.click('button[type="submit"]');
await page.waitForSelector('[data-testid="balance-amount"]');

let failed = false;
for (const route of ['/', '/transactions', '/products', '/settlement', '/history']) {
  await page.goto(`http://127.0.0.1:5173${route}`);
  await page.waitForTimeout(700);
  const metrics = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
    heading: document.querySelector('h2')?.textContent || '',
  }));
  const overflow = metrics.scroll > metrics.client;
  if (overflow) failed = true;
  console.log(`${route} | overflow=${overflow} | heading=${metrics.heading}`);
}

// Open the entry modal from the transactions page and verify it fits the screen.
await page.goto('http://127.0.0.1:5173/transactions');
await page.getByRole('button', { name: 'បន្ថែមប្រតិបត្តិការ' }).click();
await page.waitForSelector('[role="dialog"]');
const modal = await page.evaluate(() => {
  const el = document.querySelector('[role="dialog"]');
  return { width: el.getBoundingClientRect().width, scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth };
});
console.log(`modal | width=${modal.width} | overflow=${modal.scroll > modal.client}`);
if (modal.scroll > modal.client) failed = true;

await browser.close();
if (failed) process.exitCode = 1;

// Mobile QA across all pages. Requires dev servers running.
import 'dotenv/config';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 320, height: 800 } });
await page.goto('http://127.0.0.1:5173/login');
await page.fill('input[autocomplete="username"]', 'dad');
await page.fill('input[autocomplete="current-password"]', process.env.QA_PASSWORD || process.env.SEED_PASSWORD || 'change-me-123');
await page.click('button[type="submit"]');
await page.waitForSelector('[data-testid="balance-amount"]');

let failed = false;
for (const route of ['/', '/history']) {
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

// Open the entry modal from the dashboard and verify it fits the screen.
await page.goto('http://127.0.0.1:5173/');
await page.getByRole('button', { name: 'ឱ្យខ្ចី' }).click();
await page.waitForSelector('[role="dialog"]');
const modal = await page.evaluate(() => {
  const el = document.querySelector('[role="dialog"]');
  return { width: el.getBoundingClientRect().width, scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth };
});
console.log(`modal | width=${modal.width} | overflow=${modal.scroll > modal.client}`);
if (modal.scroll > modal.client) failed = true;

// Partner selector opens from the header on a 320px screen.
await page.goto('http://127.0.0.1:5173/');
await page.waitForSelector('[data-testid="balance-amount"]');
await page.click('header button[aria-label="ជ្រើសរើសដៃគូ"]');
await page.waitForSelector('[role="dialog"]');
const switcher = await page.evaluate(() => ({
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  options: document.querySelectorAll('[role="dialog"] button').length,
}));
console.log(`partner selector | overflow=${switcher.overflow} | buttons=${switcher.options}`);
if (switcher.overflow) failed = true;

await browser.close();
if (failed) process.exitCode = 1;

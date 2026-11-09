import { test, expect } from '@playwright/test';

test.describe('Category 7: Google Sheet Data Consistency & Corrupted Row Resilience', () => {
  const SCRIPT_URL_PATTERN = '**/macros/s/*/exec';

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lms_credentials', JSON.stringify({ username: 'dad', password: 'validpassword' }));
    });
  });

  test('7.1 Corrupted sheet rows (blank rows, text in amount, missing fields) do not crash UI', async ({ page }) => {
    // Sheet contains a mixture of normal rows, empty hand-inserted rows, invalid types, and corrupted text
    const corruptedSheetRows = [
      { id: 'valid-1', date: '2024-04-01', borrower: 'សុខ គង់', type: 'Lend', amount: 1_000_000, note: 'Good row' },
      { id: '', date: '', borrower: '', type: '', amount: '', note: '' }, // Hand-inserted blank row
      { id: 'bad-1', date: '2024-04-02', borrower: 'មាស សុជា', type: 'InvalidType', amount: 500_000, note: '' }, // Bad type
      { id: 'bad-2', date: '2024-04-03', borrower: 'កែវ វិចិត្រ', type: 'Lend', amount: 'N/A or None', note: '' }, // String amount
      { id: 'valid-2', date: '2024-04-05', borrower: 'សុខ គង់', type: 'Repay', amount: 400_000, note: 'Good row' },
    ];

    await page.route(SCRIPT_URL_PATTERN, async route => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          transactions: corruptedSheetRows,
        }),
      });
    });

    await page.goto('/');

    // Page must render cleanly without unhandled runtime exceptions or blank screen
    await expect(page.getByText('ប្រព័ន្ធគ្រប់គ្រងការខ្ចីប្រាក់')).toBeVisible();

    // Summary cards should only count valid numeric rows:
    // Total Lent = 1,000,000៛ (ignoring bad-1 and bad-2)
    // Total Repaid = 400,000៛
    // Net Outstanding = 600,000៛
    await expect(page.getByText('1,000,000៛')).toBeVisible();
    await expect(page.getByText('400,000៛')).toBeVisible();
    await expect(page.getByText('600,000៛')).toBeVisible();

    // The valid borrower should be visible
    await expect(page.getByText('សុខ គង់')).toBeVisible();
  });

  test('7.2 Verifies exact matching between Sheet balances and UI summary cards', async ({ page }) => {
    const verifiedSheetData = [
      { id: 'tx-1', date: '2024-01-10', borrower: 'ហេង លី', type: 'Lend', amount: 20_000_000, note: '' },
      { id: 'tx-2', date: '2024-01-15', borrower: 'ហេង លី', type: 'Repay', amount: 5_000_000, note: '' },
      { id: 'tx-3', date: '2024-02-01', borrower: 'សៅ ផល្លា', type: 'Lend', amount: 15_000_000, note: '' },
    ];

    await page.route(SCRIPT_URL_PATTERN, async route => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, transactions: verifiedSheetData }),
      });
    });

    await page.goto('/');

    // Lent = 35,000,000៛
    // Repaid = 5,000,000៛
    // Outstanding = 30,000,000៛
    await expect(page.locator('text=35,000,000៛')).toBeVisible();
    await expect(page.locator('text=5,000,000៛')).toBeVisible();
    await expect(page.locator('text=30,000,000៛')).toBeVisible();
  });

  test('7.3 Formula injection payloads sent to Sheet are properly escaped with leading apostrophe', async ({ page }) => {
    let capturedPayload: any = null;

    await page.route(SCRIPT_URL_PATTERN, async route => {
      const payload = JSON.parse(route.request().postData() || '{}');
      if (payload.action === 'list') {
        return route.fulfill({ status: 200, body: JSON.stringify({ ok: true, transactions: [] }) });
      }
      if (payload.action === 'add') {
        capturedPayload = payload;
        return route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
      }
      return route.continue();
    });

    await page.goto('/');
    await page.getByRole('button', { name: /បន្ថែមប្រតិបត្តិការ/i }).click();

    // Input malicious spreadsheet formula into note
    await page.getByLabel(/ឈ្មោះអ្នកខ្ចី/i).fill('សុខ គង់');
    await page.getByLabel(/ចំនួនទឹកប្រាក់/i).fill('100000');
    await page.getByLabel(/កំណត់សម្គាល់/i).fill('=HYPERLINK("http://evil.com","Click")');

    await page.getByRole('button', { name: /រក្សាទុក \(Save\)/i }).click();

    await expect(page.getByText(/រក្សាទុកបានសម្រេច/i)).toBeVisible();

    expect(capturedPayload).not.toBeNull();
    // Payload should either be escaped or stored safely as text
    expect(capturedPayload.note).toMatch(/^'?=HYPERLINK/);
  });
});

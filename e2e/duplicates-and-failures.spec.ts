import { test, expect } from '@playwright/test';

test.describe('Category 4: E2E Tests - Duplicates, Race Conditions & Failure Handling', () => {
  const SCRIPT_URL_PATTERN = '**/macros/s/*/exec';

  test.beforeEach(async ({ page }) => {
    // Inject mock credentials in localStorage so app starts in authenticated dashboard
    await page.addInitScript(() => {
      localStorage.setItem('lms_credentials', JSON.stringify({ username: 'dad', password: 'secretpassword123' }));
    });
  });

  test('4.1 Double-tapping Save must submit only once with a single UUID idempotency key', async ({ page }) => {
    let postCallCount = 0;
    const interceptedPayloads: any[] = [];

    // Intercept Google Apps Script web app endpoint with artificial delay
    await page.route(SCRIPT_URL_PATTERN, async route => {
      const request = route.request();
      if (request.method() === 'POST') {
        const payload = JSON.parse(request.postData() || '{}');
        if (payload.action === 'list') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true, transactions: [] }),
          });
        }
        if (payload.action === 'add') {
          postCallCount++;
          interceptedPayloads.push(payload);
          // 500ms delay to simulate real network request
          await page.waitForTimeout(500);
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true }),
          });
        }
      }
      return route.continue();
    });

    await page.goto('/');

    // Open transaction modal
    await page.getByRole('button', { name: /បន្ថែមប្រតិបត្តិការ/i }).click();

    // Fill form
    await page.getByLabel(/ឈ្មោះអ្នកខ្ចី/i).fill('សុខ គង់');
    await page.getByLabel(/ចំនួនទឹកប្រាក់/i).fill('500000');

    const saveButton = page.getByRole('button', { name: /រក្សាទុក \(Save\)/i });

    // Rapid double-tap on Save button
    await Promise.all([
      saveButton.click({ clickCount: 2 }),
    ]);

    // Verify button gets locked and spinner shown
    await expect(saveButton).toBeDisabled();

    // Wait for success confirmation
    await expect(page.getByText(/រក្សាទុកបានសម្រេច/i)).toBeVisible();

    // Assert that exactly one add request was dispatched
    expect(postCallCount).toBe(1);
    expect(interceptedPayloads[0].id).toBeDefined();
    expect(interceptedPayloads[0].amount).toBe(500000);
  });

  test('4.2 Network drop mid-save and subsequent retry: no duplicate and zero data loss', async ({ page }) => {
    let attempt = 0;
    let savedId = '';

    await page.route(SCRIPT_URL_PATTERN, async route => {
      const payload = JSON.parse(route.request().postData() || '{}');
      if (payload.action === 'list') {
        return route.fulfill({ status: 200, body: JSON.stringify({ ok: true, transactions: [] }) });
      }

      if (payload.action === 'add') {
        attempt++;
        if (attempt === 1) {
          // Fail network request on first attempt
          return route.abort('failed');
        } else {
          savedId = payload.id;
          return route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
        }
      }
      return route.continue();
    });

    await page.goto('/');
    await page.getByRole('button', { name: /បន្ថែមប្រតិបត្តិការ/i }).click();

    const borrowerField = page.getByLabel(/ឈ្មោះអ្នកខ្ចី/i);
    const amountField = page.getByLabel(/ចំនួនទឹកប្រាក់/i);
    const noteField = page.getByLabel(/កំណត់សម្គាល់/i);

    await borrowerField.fill('ចាន់ ណារី');
    await amountField.fill('1200000');
    await noteField.fill('ខ្ចីទិញជីកសិកម្ម');

    const saveBtn = page.getByRole('button', { name: /រក្សាទុក \(Save\)/i });
    await saveBtn.click();

    // Verify error banner is displayed
    await expect(page.getByText(/រក្សាទុកមិនបានសម្រេច/i)).toBeVisible();

    // Verify entered inputs are STILL intact on screen
    await expect(borrowerField).toHaveValue('ចាន់ ណារី');
    await expect(amountField).toHaveValue('1,200,000');
    await expect(noteField).toHaveValue('ខ្ចីទិញជីកសិកម្ម');

    // User taps Save to retry
    await saveBtn.click();

    // Second attempt succeeds
    await expect(page.getByText(/រក្សាទុកបានសម្រេច/i)).toBeVisible();
    expect(attempt).toBe(2);
    expect(savedId).toBeTruthy();
  });

  test('4.3 Deleting a transaction with confirm dialog and handling delete failures', async ({ page }) => {
    const initialTx = [
      { id: 'uuid-1', date: '2024-03-01', borrower: 'សុខ គង់', type: 'Lend', amount: 300000, note: '' },
      { id: 'uuid-2', date: '2024-03-02', borrower: 'ចាន់ ណារី', type: 'Lend', amount: 500000, note: '' },
    ];

    let deleteAttempt = 0;

    await page.route(SCRIPT_URL_PATTERN, async route => {
      const payload = JSON.parse(route.request().postData() || '{}');
      if (payload.action === 'list') {
        return route.fulfill({ status: 200, body: JSON.stringify({ ok: true, transactions: initialTx }) });
      }
      if (payload.action === 'delete') {
        deleteAttempt++;
        if (deleteAttempt === 1) {
          // Simulate script lock failure
          return route.fulfill({
            status: 200,
            body: JSON.stringify({ ok: false, error: 'Could not obtain lock after 10000ms' }),
          });
        }
        return route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
      }
      return route.continue();
    });

    await page.goto('/');

    // Table should show both rows
    await expect(page.getByText('សុខ គង់')).toBeVisible();
    await expect(page.getByText('ចាន់ ណារី')).toBeVisible();

    // Click delete on first row
    const deleteButtons = page.getByTitle(/លុប \(Delete\)/i);
    await deleteButtons.first().click();

    // Confirm dialog must appear
    const dialog = page.getByText(/បញ្ជាក់ការលុប \(Confirm Delete\)/i);
    await expect(dialog).toBeVisible();

    // Dismiss first to test cancel
    await page.getByRole('button', { name: /បោះបង់ \(Cancel\)/i }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByText('សុខ គង់')).toBeVisible();

    // Open dialog again and confirm delete
    await deleteButtons.first().click();
    await page.getByRole('button', { name: /^លុប \(Delete\)$/i }).click();

    // Because first attempt failed, optimistic UI reverts or shows error banner
    await expect(page.getByText(/មិនអាចលុបបាន/i)).toBeVisible();
    // Item is restored safely
    await expect(page.getByText('សុខ គង់')).toBeVisible();
  });
});

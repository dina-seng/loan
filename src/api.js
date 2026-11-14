const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL?.trim();
const API_URL = import.meta.env.DEV ? '/api/apps-script' : APPS_SCRIPT_URL;

/**
 * Translate backend errors to natural, clear Khmer messages.
 */
export function getKhmerErrorMessage(errorCode) {
  const code = String(errorCode || '').trim();
  const map = {
    already_settled: 'ខែនេះបានទូទាត់រួចរាល់ហើយ',
    server_busy_try_again: 'ប្រព័ន្ធកំពុងរវល់ សូមព្យាយាមម្តងទៀត',
    lock_timeout: 'ប្រព័ន្ធកំពុងរវល់ សូមព្យាយាមម្តងទៀត',
    invalid_settlement_data: 'ទិន្នន័យទូទាត់មិនត្រឹមត្រូវ',
    invalid_borrower: 'សូមជ្រើសរើសឈ្មោះអ្នកខ្ចី',
    invalid_date: 'កាលបរិច្ឆេទមិនត្រឹមត្រូវ',
    invalid_type: 'ប្រភេទប្រតិបត្តិការមិនត្រឹមត្រូវ',
    invalid_credentials: 'ឈ្មោះគណនី ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ',
    unauthorized: 'ឈ្មោះគណនី ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ',
    month_settled: 'ខែនេះត្រូវបានទូទាត់បិទបញ្ជីរួចរាល់ហើយ មិនអាចកែប្រែបានទេ',
    not_found: 'រកមិនឃើញទិន្នន័យនេះទេ',
    server_misconfigured: 'ប្រព័ន្ធមិនទាន់បានកំណត់រចនាសម្ព័ន្ធត្រឹមត្រូវទេ',
    timeout: 'ប្រព័ន្ធឆ្លើយតបយឺតពេក សូមព្យាយាមម្តងទៀត',
  };
  return map[code] || errorCode || 'មានបញ្ហាមិនស្គាល់ សូមព្យាយាមម្តងទៀត';
}

/**
 * Make a POST request to the Google Apps Script web app.
 * Uses Content-Type: text/plain to avoid slow CORS OPTIONS preflight.
 * Enforces a 15000ms AbortController timeout.
 */
async function request(body) {
  if (!APPS_SCRIPT_URL) {
    throw new Error('VITE_APPS_SCRIPT_URL is not set. Check your .env file.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(getKhmerErrorMessage('server_busy_try_again'));
    }

    if (!data.ok) {
      const err = new Error(getKhmerErrorMessage(data.error));
      err.code = data.error;
      throw err;
    }

    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      const timeoutErr = new Error(getKhmerErrorMessage('timeout'));
      timeoutErr.code = 'timeout';
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Credentials management
 */
export function getCredentials() {
  try {
    const stored = localStorage.getItem('lms_credentials');
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  return null;
}

export function saveCredentials(username, password) {
  localStorage.setItem('lms_credentials', JSON.stringify({ username, password }));
}

export function clearCredentials() {
  localStorage.removeItem('lms_credentials');
}

/**
 * Fetch all transactions.
 */
export async function listTransactions(username, password) {
  const data = await request({ username, password, action: 'list' });
  return data.transactions || [];
}

/**
 * Add a new transaction.
 */
export async function addTransaction(username, password, { id, date, borrower, type, amount, note }) {
  return request({
    username,
    password,
    action: 'add',
    id,
    date,
    borrower,
    type,
    amount: Math.round(Number(amount)),
    note: note || '',
  });
}

/**
 * Delete a transaction by id.
 */
export async function deleteTransaction(username, password, id) {
  return request({ username, password, action: 'delete', id });
}

/**
 * Fetch all products.
 */
export async function listProducts(username, password) {
  try {
    const data = await request({ username, password, action: 'list_products' });
    return data.products || [];
  } catch (err) {
    console.warn('Unable to load products:', err);
    return [];
  }
}

/**
 * Add a new product entry.
 */
export async function addProduct(
  username,
  password,
  { id, date, borrower, item, itemName, quantity, unitPrice, note },
) {
  return request({
    username,
    password,
    action: 'add_product',
    id: id || crypto.randomUUID(),
    date,
    borrower,
    item: item || itemName || '',
    quantity: Math.round(Number(quantity) * 100) / 100,
    unitPrice: Math.round(Number(unitPrice)),
    note: note || '',
  });
}

/**
 * Delete a product entry by id.
 */
export async function deleteProduct(username, password, id) {
  return request({ username, password, action: 'delete_product', id });
}

/**
 * Fetch all settlements.
 */
export async function listSettlements(username, password) {
  try {
    const data = await request({ username, password, action: 'list_settlements' });
    return data.settlements || [];
  } catch (err) {
    console.warn('Unable to load settlements:', err);
    return [];
  }
}

/**
 * Record a month settlement.
 */
export async function settleMonth(
  username,
  password,
  {
    id,
    month,
    borrower,
    totalLent,
    totalGoods,
    paid,
    direction,
    date,
  },
) {
  return request({
    action: 'settle_month',
    username,
    password,
    id: id || crypto.randomUUID(),
    borrower,
    month,
    date,
    totalLent: Math.round(Number(totalLent || 0)),
    totalGoods: Math.round(Number(totalGoods || 0)),
    paid: Math.round(Number(paid != null ? paid : 0)),
    direction: direction || 'cleared',
  });
}

/**
 * Reopen a settled month.
 */
export async function reopenMonth(username, password, { id, month, borrower }) {
  return request({
    username,
    password,
    action: 'reopen_month',
    id,
    month,
    borrower,
  });
}

/**
 * Rename/merge borrower across Transactions, Products, and Settlements.
 */
export async function renameBorrower(username, password, from, to) {
  return request({ username, password, action: 'rename_borrower', from, to });
}

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL?.trim();
const API_URL = import.meta.env.DEV ? '/api/apps-script' : APPS_SCRIPT_URL;

/**
 * Make a POST request to the Google Apps Script web app.
 * Uses Content-Type: text/plain to avoid CORS preflight.
 */
async function request(body) {
  if (!APPS_SCRIPT_URL) {
    throw new Error('VITE_APPS_SCRIPT_URL is not set. Check your .env file.');
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
    redirect: 'follow',
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      'ប្រព័ន្ធ Google Sheet កំពុងមមាញឹក សូមរង់ចាំបន្តិចហើយព្យាយាមម្តងទៀត (Google Apps Script is busy, please try again in a few moments)',
    );
  }

  if (!data.ok) {
    const err = new Error(data.error || 'Unknown error');
    err.code = data.error;
    throw err;
  }

  return data;
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
  { id, date, borrower, item, quantity, unitPrice, note },
) {
  return request({
    username,
    password,
    action: 'add_product',
    id: id || crypto.randomUUID(),
    date,
    borrower,
    item: item || '',
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
  { id, month, borrower, balanceBefore, paid, direction, carriedOver, date },
) {
  return request({
    username,
    password,
    action: 'settle_month',
    id: id || crypto.randomUUID(),
    month,
    borrower,
    balanceBefore: Math.round(Number(balanceBefore)),
    paid: Math.round(Number(paid)),
    direction,
    carriedOver: Math.round(Number(carriedOver)),
    date,
  });
}

/**
 * Reopen a settled month.
 */
export async function reopenMonth(username, password, { month, borrower }) {
  return request({
    username,
    password,
    action: 'reopen_month',
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

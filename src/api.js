const API_URL = import.meta.env.VITE_APPS_SCRIPT_URL?.trim();

/**
 * Make a POST request to the Google Apps Script web app.
 * Uses Content-Type: text/plain to avoid CORS preflight.
 */
async function request(body) {
  if (!API_URL) {
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
    throw new Error('ប្រព័ន្ធ Google Sheet កំពុងមមាញឹក សូមរង់ចាំបន្តិចហើយព្យាយាមម្តងទៀត (Google Apps Script is busy, please try again in a few moments)');
  }

  if (!data.ok) {
    const err = new Error(data.error || 'Unknown error');
    err.code = data.error;
    throw err;
  }

  return data;
}

/**
 * Get credentials from localStorage.
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

/**
 * Save credentials to localStorage.
 */
export function saveCredentials(username, password) {
  localStorage.setItem('lms_credentials', JSON.stringify({ username, password }));
}

/**
 * Clear credentials from localStorage.
 */
export function clearCredentials() {
  localStorage.removeItem('lms_credentials');
}

/**
 * Fetch all transactions.
 */
export async function listTransactions(username, password) {
  const data = await request({ username, password, action: 'list' });
  return data.transactions;
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
    amount,
    note: note || '',
  });
}

/**
 * Delete a transaction by id.
 */
export async function deleteTransaction(username, password, id) {
  return request({ username, password, action: 'delete', id });
}

export async function renameBorrower(username, password, from, to) {
  return request({ username, password, action: 'rename_borrower', from, to });
}

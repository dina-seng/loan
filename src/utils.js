/**
 * Format an integer amount as Khmer Riel with thousands separators.
 * e.g. 1500000 -> "1,500,000៛"
 */
export function formatMoney(amount) {
  if (amount == null || isNaN(amount)) return '0៛';
  return Number(amount).toLocaleString('en-US') + '៛';
}

/**
 * Parse a formatted money string back to integer.
 * Strips commas, ៛ symbol, spaces. Returns 0 for invalid input.
 */
export function parseMoney(str) {
  if (!str) return 0;
  const cleaned = String(str).replace(/[,៛\s]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Format input value with thousands separators while typing.
 * Returns the formatted string (digits and commas only).
 */
export function formatInputNumber(value) {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('en-US');
}

/**
 * Get raw integer from a formatted input string.
 */
export function getRawNumber(value) {
  if (!value) return 0;
  const digits = String(value).replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

/**
 * Compute summary totals from transactions array.
 * @param {Array} transactions - [{id, date, borrower, type, amount, note}]
 * @returns {{ totalLent: number, totalRepaid: number, netOutstanding: number }}
 */
export function computeTotals(transactions) {
  let totalLent = 0;
  let totalRepaid = 0;
  for (const t of transactions) {
    if (t.type === 'Lend') totalLent += Number(t.amount);
    else if (t.type === 'Repay') totalRepaid += Number(t.amount);
  }
  return {
    totalLent,
    totalRepaid,
    netOutstanding: totalLent - totalRepaid,
  };
}

/**
 * Compute per-borrower summary.
 * @param {Array} transactions
 * @returns {Array<{borrower, totalBorrowed, totalRepaid, outstanding, status}>}
 */
export function computeBorrowerSummary(transactions) {
  const map = {};
  for (const t of transactions) {
    if (!map[t.borrower]) {
      map[t.borrower] = { borrower: t.borrower, totalBorrowed: 0, totalRepaid: 0 };
    }
    if (t.type === 'Lend') map[t.borrower].totalBorrowed += Number(t.amount);
    else if (t.type === 'Repay') map[t.borrower].totalRepaid += Number(t.amount);
  }
  return Object.values(map).map(b => ({
    ...b,
    outstanding: b.totalBorrowed - b.totalRepaid,
    status: b.totalBorrowed - b.totalRepaid === 0 ? 'paid' : 'owing',
  }));
}

/**
 * Normalizes any date representation (including Google Sheets date strings) to 'yyyy-mm-dd'.
 */
export function normalizeDate(dateVal) {
  if (!dateVal) return '';
  const str = String(dateVal).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return str.slice(0, 10);
}

/**
 * Compute monthly breakdown from transactions.
 * Groups by yyyy-MM (from transaction date). Within each month: lent, repaid, balance.
 * Returns sorted by month descending (newest first).
 * @param {Array} transactions
 * @returns {Array<{month, lent, repaid, balance}>}
 */
export function computeMonthlyTable(transactions) {
  const map = {};
  for (const t of transactions) {
    const month = normalizeDate(t.date).substring(0, 7); // yyyy-MM
    if (!month || month.length < 7) continue;
    if (!map[month]) map[month] = { month, lent: 0, repaid: 0 };
    if (t.type === 'Lend') map[month].lent += Number(t.amount);
    else if (t.type === 'Repay') map[month].repaid += Number(t.amount);
  }
  return Object.values(map)
    .map(m => ({ ...m, balance: m.lent - m.repaid }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

/**
 * Get unique borrower names from transactions.
 */
export function getUniqueBorrowers(transactions) {
  const borrowers = new Map();
  for (const transaction of transactions) {
    const name = normalizeBorrowerName(transaction.borrower);
    if (name && !borrowers.has(name.toLowerCase())) {
      borrowers.set(name.toLowerCase(), name);
    }
  }
  return [...borrowers.values()];
}

export function normalizeBorrowerName(value) {
  return String(value ?? '')
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findBorrowerNameMatch(candidate, borrowers) {
  const normalizedCandidate = normalizeBorrowerName(candidate);
  const candidateKey = normalizedCandidate.toLowerCase();
  if (!candidateKey) return null;

  const names = borrowers.map(normalizeBorrowerName).filter(Boolean);
  const exactMatch = names.find(name => name.toLowerCase() === candidateKey);
  if (exactMatch) return { type: 'exact', borrower: exactMatch };

  const candidateChars = Array.from(candidateKey);
  let closestMatch = null;
  for (const name of names) {
    const nameKey = name.toLowerCase();
    const nameChars = Array.from(nameKey);
    const longestLength = Math.max(candidateChars.length, nameChars.length);
    if (longestLength < 4) continue;

    let previousRow = Array.from({ length: nameChars.length + 1 }, (_, index) => index);
    for (let i = 1; i <= candidateChars.length; i += 1) {
      const currentRow = [i];
      for (let j = 1; j <= nameChars.length; j += 1) {
        currentRow[j] = Math.min(
          currentRow[j - 1] + 1,
          previousRow[j] + 1,
          previousRow[j - 1] + (candidateChars[i - 1] === nameChars[j - 1] ? 0 : 1),
        );
      }
      previousRow = currentRow;
    }

    const similarity = 1 - previousRow[nameChars.length] / longestLength;
    if (similarity >= 0.8 && (!closestMatch || similarity > closestMatch.similarity)) {
      closestMatch = { type: 'similar', borrower: name, similarity };
    }
  }
  return closestMatch;
}

/**
 * Format a date string (yyyy-mm-dd) for display.
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  return normalizeDate(dateStr);
}

/**
 * Get today's date as yyyy-mm-dd string.
 */
export function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Get month options from transactions for filter.
 * Returns array of {value, label} sorted descending.
 */
export function getMonthOptions(transactions) {
  const months = new Set();
  for (const t of transactions) {
    const m = normalizeDate(t.date).substring(0, 7);
    if (m) months.add(m);
  }
  return [...months]
    .sort((a, b) => b.localeCompare(a))
    .map(m => ({ value: m, label: m }));
}

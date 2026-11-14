/**
 * Khmer Lending Management & Product Offset Tracker Utilities
 */

/**
 * Convert Khmer digits (០-៩) to Western digits (0-9).
 */
export function convertKhmerDigits(str) {
  if (str == null) return '';
  const khmerDigits = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
  return String(str).replace(/[០-៩]/g, (char) => {
    const idx = khmerDigits.indexOf(char);
    return idx !== -1 ? String(idx) : char;
  });
}

/**
 * Format an integer amount as Khmer Riel with thousands separators.
 * e.g. 1500000 -> "1,500,000៛"
 */
export function formatMoney(amount) {
  if (amount == null || isNaN(amount)) return '0៛';
  const num = Math.round(Number(amount));
  return num.toLocaleString('en-US') + '៛';
}

/**
 * Parse a formatted money string back to integer.
 * Strips commas, ៛ symbol, spaces. Returns 0 for invalid input.
 */
export function parseMoney(str) {
  if (!str) return 0;
  const converted = convertKhmerDigits(str);
  const cleaned = String(converted).replace(/[,៛\s]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Format input value with thousands separators while typing.
 * Converts Khmer digits to Western digits. Returns formatted string.
 */
export function formatInputNumber(value) {
  if (!value) return '';
  const converted = convertKhmerDigits(value);
  const digits = String(converted).replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('en-US');
}

/**
 * Get raw integer from a formatted input string.
 */
export function getRawNumber(value) {
  if (!value) return 0;
  const converted = convertKhmerDigits(value);
  const digits = String(converted).replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

/**
 * Format product quantity with up to 2 decimals.
 * Converts Khmer digits to Western digits.
 */
export function formatInputQuantity(value) {
  if (value == null || value === '') return '';
  const converted = convertKhmerDigits(value);
  const cleaned = converted.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    return parts[0] + '.' + parts.slice(1).join('');
  }
  if (parts.length === 2) {
    return parts[0] + '.' + parts[1].slice(0, 2);
  }
  return cleaned;
}

/**
 * Get raw quantity (float up to 2 decimal places).
 */
export function getRawQuantity(value) {
  if (value == null || value === '') return 0;
  const converted = convertKhmerDigits(value);
  const num = parseFloat(converted);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

/**
 * Core business formula:
 * Balance = Lend - Repay - ProductValue + Refund
 *
 * Balance > 0: Borrower owes dad (Amber)
 * Balance < 0: Dad owes borrower (Blue)
 * Balance = 0: Cleared (Green)
 */
export function calculateBalance({ lent = 0, repaid = 0, productValue = 0, refunded = 0 }) {
  const l = Number(lent) || 0;
  const r = Number(repaid) || 0;
  const p = Number(productValue) || 0;
  const ref = Number(refunded) || 0;
  return Math.round(l - r - p + ref);
}

/**
 * Return settlement status metadata with colors and Khmer/English labels.
 */
export function getSettlementStatus(balance) {
  const num = Number(balance) || 0;
  if (num > 0) {
    return {
      key: 'borrower_owes',
      direction: 'borrower_pays_dad',
      label: 'អ្នកខ្ចីជំពាក់លោកប៉ា (Borrower owes dad)',
      shortLabel: 'អ្នកខ្ចីជំពាក់ (Borrower owes)',
      color: 'amber',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
      bannerClass: 'bg-amber-50/95 border-amber-400 text-amber-950',
    };
  }
  if (num < 0) {
    return {
      key: 'dad_owes',
      direction: 'dad_pays_borrower',
      label: 'លោកប៉ាត្រូវបើកសងអ្នកខ្ចី (Dad owes borrower)',
      shortLabel: 'ប៉ាត្រូវសងវិញ (Dad owes)',
      color: 'blue',
      badgeClass: 'bg-blue-50 text-blue-800 border-blue-300',
      bannerClass: 'bg-blue-50/95 border-blue-400 text-blue-950',
    };
  }
  return {
    key: 'cleared',
    direction: 'cleared',
    label: 'ទូទាត់រួចរាល់ស្មើគ្នា (Cleared)',
    shortLabel: 'ទូទាត់រួច (Cleared)',
    color: 'green',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    bannerClass: 'bg-emerald-50/95 border-emerald-400 text-emerald-950',
  };
}

/**
 * Compute summary totals across transactions and products.
 */
export function computeTotals(transactions = [], products = []) {
  let totalLent = 0;
  let totalRepaid = 0;
  let totalRefunded = 0;

  for (const t of transactions) {
    const amt = Number(t.amount) || 0;
    if (t.type === 'Lend') totalLent += amt;
    else if (t.type === 'Repay') totalRepaid += amt;
    else if (t.type === 'Refund') totalRefunded += amt;
  }

  let totalProducts = 0;
  if (Array.isArray(products)) {
    for (const p of products) {
      const itemTotal =
        p.total != null && !isNaN(p.total)
          ? Number(p.total)
          : Math.round((Number(p.quantity) || 0) * (Number(p.unitPrice) || 0));
      totalProducts += itemTotal;
    }
  }

  const balance = calculateBalance({
    lent: totalLent,
    repaid: totalRepaid,
    productValue: totalProducts,
    refunded: totalRefunded,
  });

  return {
    totalLent,
    totalRepaid,
    totalRefunded,
    totalProducts,
    netRepaidRefunded: totalRepaid - totalRefunded,
    balance,
    netOutstanding: totalLent - totalRepaid, // backward compatibility
    status: getSettlementStatus(balance),
  };
}

/**
 * Compute per-borrower summary.
 */
export function computeBorrowerSummary(transactions = [], products = []) {
  const map = {};

  for (const t of transactions) {
    const borrower = normalizeBorrowerName(t.borrower);
    if (!borrower) continue;
    const key = borrower.toLowerCase();
    if (!map[key]) {
      map[key] = {
        borrower,
        totalLent: 0,
        totalRepaid: 0,
        totalRefunded: 0,
        totalProducts: 0,
        transactionCount: 0,
      };
    }
    const amt = Number(t.amount) || 0;
    if (t.type === 'Lend') map[key].totalLent += amt;
    else if (t.type === 'Repay') map[key].totalRepaid += amt;
    else if (t.type === 'Refund') map[key].totalRefunded += amt;
    map[key].transactionCount += 1;
  }

  if (Array.isArray(products)) {
    for (const p of products) {
      const borrower = normalizeBorrowerName(p.borrower);
      if (!borrower) continue;
      const key = borrower.toLowerCase();
      if (!map[key]) {
        map[key] = {
          borrower,
          totalLent: 0,
          totalRepaid: 0,
          totalRefunded: 0,
          totalProducts: 0,
          transactionCount: 0,
        };
      }
      const itemTotal =
        p.total != null && !isNaN(p.total)
          ? Number(p.total)
          : Math.round((Number(p.quantity) || 0) * (Number(p.unitPrice) || 0));
      map[key].totalProducts += itemTotal;
    }
  }

  return Object.values(map).map((b) => {
    const balance = calculateBalance({
      lent: b.totalLent,
      repaid: b.totalRepaid,
      productValue: b.totalProducts,
      refunded: b.totalRefunded,
    });
    const status = getSettlementStatus(balance);
    const outstanding = b.totalLent - b.totalRepaid;
    return {
      ...b,
      totalBorrowed: b.totalLent,
      totalRepaid: b.totalRepaid,
      totalProducts: b.totalProducts,
      outstanding,
      balance,
      settlement: balance,
      status: outstanding === 0 ? 'paid' : 'owing',
      settlementStatus: status.key,
      statusInfo: status,
    };
  });
}

/**
 * Total value of products for a borrower (or all).
 */
export function computeProductTotal(products, borrower = null) {
  if (!products || !Array.isArray(products)) return 0;
  const target = borrower ? normalizeBorrowerName(borrower).toLowerCase() : null;
  return products.reduce((sum, p) => {
    if (target && normalizeBorrowerName(p.borrower).toLowerCase() !== target) {
      return sum;
    }
    const itemTotal =
      p.total != null && !isNaN(p.total)
        ? Number(p.total)
        : Math.round((Number(p.quantity) || 0) * (Number(p.unitPrice) || 0));
    return sum + itemTotal;
  }, 0);
}

/**
 * Backward compatibility alias for calculateBalance.
 */
export function computeSettlement(outstandingLoan, totalProductValue) {
  return calculateBalance({
    lent: Number(outstandingLoan) || 0,
    repaid: 0,
    productValue: Number(totalProductValue) || 0,
    refunded: 0,
  });
}

/**
 * Normalizes any date representation (including Google Sheets date strings) to 'yyyy-mm-dd'
 * using LOCAL timezone (never toISOString to avoid UTC shift in UTC+7).
 */
export function normalizeDate(dateVal) {
  if (!dateVal) return '';
  const converted = convertKhmerDigits(dateVal);
  const str = String(converted).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // Handle DD/MM/YYYY or MM/DD/YYYY
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    let p1 = parseInt(slashMatch[1], 10);
    let p2 = parseInt(slashMatch[2], 10);
    const y = slashMatch[3];
    const m = p1 > 12 ? p2 : p1;
    const d = p1 > 12 ? p1 : p2;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // Handle YYYY/MM/DD
  const slashYMD = str.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (slashYMD) {
    return `${slashYMD[1]}-${String(slashYMD[2]).padStart(2, '0')}-${String(slashYMD[3]).padStart(2, '0')}`;
  }

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
 * Format a date string (yyyy-mm-dd) for display.
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  return normalizeDate(dateStr);
}

/**
 * Today's date as yyyy-mm-dd string in local timezone.
 */
export function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Compute full monthly breakdown table:
 * Month | Lent | Repaid | Products | Refunded | Net balance for month | Running balance | Status (Open/Settled)
 * Sorted descending (newest month first).
 */
export function computeMonthlyTable(transactions = [], products = [], settlements = [], activeBorrower = null) {
  const map = {};
  const targetBorrower = activeBorrower ? normalizeBorrowerName(activeBorrower).toLowerCase() : null;

  // Process transactions
  for (const t of transactions) {
    if (targetBorrower && normalizeBorrowerName(t.borrower).toLowerCase() !== targetBorrower) {
      continue;
    }
    const month = normalizeDate(t.date).substring(0, 7);
    if (!month || month.length < 7) continue;

    if (!map[month]) {
      map[month] = { month, lent: 0, repaid: 0, products: 0, refunded: 0 };
    }
    const amt = Number(t.amount) || 0;
    if (t.type === 'Lend') map[month].lent += amt;
    else if (t.type === 'Repay') map[month].repaid += amt;
    else if (t.type === 'Refund') map[month].refunded += amt;
  }

  // Process products
  if (Array.isArray(products)) {
    for (const p of products) {
      if (targetBorrower && normalizeBorrowerName(p.borrower).toLowerCase() !== targetBorrower) {
        continue;
      }
      const month = normalizeDate(p.date).substring(0, 7);
      if (!month || month.length < 7) continue;

      if (!map[month]) {
        map[month] = { month, lent: 0, repaid: 0, products: 0, refunded: 0 };
      }
      const itemTotal =
        p.total != null && !isNaN(p.total)
          ? Number(p.total)
          : Math.round((Number(p.quantity) || 0) * (Number(p.unitPrice) || 0));
      map[month].products += itemTotal;
    }
  }

  // Index settlements
  const settledMonths = new Map();
  if (Array.isArray(settlements)) {
    for (const s of settlements) {
      const sBorrower = normalizeBorrowerName(s.borrower).toLowerCase();
      if (!targetBorrower || sBorrower === targetBorrower) {
        settledMonths.set(String(s.month), s);
      }
    }
  }

  // Sort chronological ascending to calculate cumulative running balance
  const ascendingMonths = Object.keys(map).sort();
  let cumulative = 0;
  const monthResults = [];

  for (const m of ascendingMonths) {
    const entry = map[m];
    // Net balance for month = Lent - Repay - Products + Refund
    const netBalance = calculateBalance({
      lent: entry.lent,
      repaid: entry.repaid,
      productValue: entry.products,
      refunded: entry.refunded,
    });
    cumulative += netBalance;
    const settlementRecord = settledMonths.get(m);
    const isSettled = !!settlementRecord;

    monthResults.push({
      month: m,
      lent: entry.lent,
      repaid: entry.repaid,
      products: entry.products,
      refunded: entry.refunded,
      balance: netBalance, // backward compatibility
      netBalance,
      runningBalance: cumulative,
      isSettled,
      status: isSettled ? 'Settled' : 'Open',
      statusKhmer: isSettled ? 'ទូទាត់រួច (Settled)' : 'នៅដំណើរការ (Open)',
      settlementRecord: settlementRecord || null,
    });
  }

  // Return newest first
  return monthResults.sort((a, b) => b.month.localeCompare(a.month));
}

/**
 * Check whether a transaction or product record is settled/archived.
 */
export function isRecordSettled(record, settlements = []) {
  if (!record) return false;
  if (record.settled === true) return true;
  if (!record.date || !Array.isArray(settlements) || settlements.length === 0) {
    return false;
  }
  const m = normalizeDate(record.date).slice(0, 7);
  const b = normalizeBorrowerName(record.borrower).toLowerCase();
  return settlements.some(
    (s) =>
      String(s.month || '').trim() === m &&
      normalizeBorrowerName(s.borrower).toLowerCase() === b,
  );
}

/**
 * Get unique borrower names from transactions and products.
 */
export function getUniqueBorrowers(transactions = [], products = []) {
  const borrowers = new Map();
  for (const transaction of transactions) {
    const name = normalizeBorrowerName(transaction.borrower);
    if (name && !borrowers.has(name.toLowerCase())) {
      borrowers.set(name.toLowerCase(), name);
    }
  }
  if (Array.isArray(products)) {
    for (const product of products) {
      const name = normalizeBorrowerName(product.borrower);
      if (name && !borrowers.has(name.toLowerCase())) {
        borrowers.set(name.toLowerCase(), name);
      }
    }
  }
  return [...borrowers.values()];
}

/**
 * Normalize borrower name:
 * Trim, collapse repeated whitespace, strip zero-width characters, Unicode NFC.
 */
export function normalizeBorrowerName(value) {
  return String(value ?? '')
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fuzzy similarity comparison for duplicate name warnings.
 */
export function findBorrowerNameMatch(candidate, borrowers) {
  const normalizedCandidate = normalizeBorrowerName(candidate);
  const candidateKey = normalizedCandidate.toLowerCase();
  if (!candidateKey) return null;

  const names = borrowers.map(normalizeBorrowerName).filter(Boolean);
  const exactMatch = names.find((name) => name.toLowerCase() === candidateKey);
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
          previousRow[j - 1] + (candidateChars[i - 1] === nameChars[j - 1] ? 0 : 1)
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
 * Get month options for filters.
 */
export function getMonthOptions(transactions = [], products = []) {
  const months = new Set();
  for (const t of transactions) {
    const m = normalizeDate(t.date).substring(0, 7);
    if (m) months.add(m);
  }
  if (Array.isArray(products)) {
    for (const p of products) {
      const m = normalizeDate(p.date).substring(0, 7);
      if (m) months.add(m);
    }
  }
  return [...months].sort((a, b) => b.localeCompare(a)).map((m) => ({ value: m, label: m }));
}

/**
 * Export data to CSV with UTF-8 BOM so Khmer text opens properly in Excel.
 */
export function exportToCsv(filename, rows, headers) {
  if (!rows || !rows.length) return false;
  const escapeCell = (val) => {
    if (val == null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerRow = headers.map((h) => escapeCell(h.label)).join(',');
  const dataRows = rows.map((row) => headers.map((h) => escapeCell(row[h.key])).join(','));
  const csvContent = '\uFEFF' + [headerRow, ...dataRows].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

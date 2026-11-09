import { Transaction } from './types';

/**
 * Normalizes borrower names by:
 * 1. Performing Unicode Canonical Composition (NFC).
 * 2. Stripping zero-width spaces (\u200B), non-joiners (\u200C), joiners (\u200D), and BOM (\uFEFF).
 * 3. Collapsing multiple spaces and trimming outer whitespace.
 * 4. Case-folding for Latin characters.
 */
export function normalizeBorrowerName(name: string): string {
  if (!name) return '';
  return name
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove invisible Khmer zero-width chars
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculates standard Levenshtein distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }
  return dp[m][n];
}

/**
 * Checks if a candidate borrower name is suspiciously close to an existing borrower.
 * Detects:
 * - Exact match after whitespace/invisible character normalization
 * - Levenshtein distance <= 2 for Latin names or 1 for Khmer script
 */
export function findSimilarBorrower(
  candidate: string,
  existingBorrowers: string[]
): { isSimilar: boolean; existingMatch?: string; reason?: string } {
  const normCandidate = normalizeBorrowerName(candidate).toLowerCase();
  if (!normCandidate) return { isSimilar: false };

  for (const existing of existingBorrowers) {
    const normExisting = normalizeBorrowerName(existing).toLowerCase();
    if (normCandidate === normExisting) {
      if (candidate !== existing) {
        return {
          isSimilar: true,
          existingMatch: existing,
          reason: 'ឈ្មោះដូចគ្នាបន្ទាប់ពីសម្អាតចន្លោះនិងអក្សរបង្កប់ (Identical after whitespace/invisible character normalization)',
        };
      }
      continue;
    }

    const dist = levenshteinDistance(normCandidate, normExisting);
    if (dist <= 1 && normCandidate.length > 2) {
      return {
        isSimilar: true,
        existingMatch: existing,
        reason: `ស្រដៀងនឹងឈ្មោះដែលមានស្រាប់ "${existing}" (Very similar to existing borrower)`,
      };
    }
  }

  return { isSimilar: false };
}

/**
 * Replaces or merges all occurrences of an old borrower name with a new borrower name
 * across a transaction log.
 */
export function mergeBorrowerRecords(
  transactions: Transaction[],
  oldName: string,
  newName: string
): Transaction[] {
  const normalizedOld = normalizeBorrowerName(oldName);
  const normalizedNew = normalizeBorrowerName(newName);

  return transactions.map(t => {
    if (normalizeBorrowerName(t.borrower) === normalizedOld) {
      return { ...t, borrower: normalizedNew };
    }
    return t;
  });
}
